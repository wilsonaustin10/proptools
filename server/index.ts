import express, { type Express, type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import dotenv from "dotenv";
import { Server, createServer } from "http";
import { DatabaseError, statusCodeMap, DatabaseErrorCode } from "../shared/errors/database";
import { setupAuth } from "./auth";

// Load environment variables
dotenv.config();

export const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Set up authentication before other middleware and routes
  const authRouter = setupAuth(app);
  app.use('/api', authRouter);

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  // Register routes under /api prefix
  console.log('Registering routes...');
  const apiRouter = registerRoutes(app);
  app.use('/api', apiRouter);

  // Log all registered routes
  console.log('All routes:', app._router.stack
    .filter((r: any) => r.route || (r.handle && r.handle.stack))
    .map((r: any) => {
      if (r.route) {
        const methods = Object.keys(r.route.methods || {});
        return `${methods.join(',')} ${r.route.path}`;
      }
      if (r.handle && r.handle.stack) {
        return `Router middleware at ${r.regexp}`;
      }
      return null;
    })
    .filter(Boolean)
    .join('\n'));

  // Create HTTP server
  const server = createServer(app);

  // Error handling middleware - must be registered after routes
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    console.error('Error handler received:', {
      error: err,
      name: err.name,
      message: err.message,
      constructor: err.constructor?.name,
      prototype: Object.getPrototypeOf(err)?.constructor?.name,
      isDatabaseError: err instanceof DatabaseError,
      hasStatusCode: 'statusCode' in err,
      statusCode: err.statusCode,
      code: err.code,
      stack: err.stack,
      // Additional debugging info
      errorToString: err.toString(),
      errorKeys: Object.keys(err),
      errorDescriptor: Object.getOwnPropertyDescriptor(err, 'constructor'),
      prototypeChain: (function getPrototypeChain(obj) {
        const chain = [];
        let current = obj;
        while (current) {
          chain.push(current.constructor?.name);
          current = Object.getPrototypeOf(current);
        }
        return chain;
      })(err),
      // More detailed error inspection
      isError: err instanceof Error,
      isDatabaseErrorByName: err.name === 'DatabaseError',
      isDatabaseErrorByConstructor: err.constructor?.name === 'DatabaseError',
      errorPrototype: Object.getPrototypeOf(err),
      databaseErrorPrototype: Object.getPrototypeOf(DatabaseError),
      databaseErrorInstance: new DatabaseError('test', 'NOT_FOUND'),
      compareWithNew: err instanceof DatabaseError === (new DatabaseError('test', 'NOT_FOUND')) instanceof DatabaseError,
      fullErrorDump: JSON.stringify(err, Object.getOwnPropertyNames(err)),
      // Check if error is a DatabaseError by checking both instanceof and properties
      isDatabaseErrorByProperties: err.name === 'DatabaseError' && 'code' in err && 'statusCode' in err
    });

    // Log detailed error information for debugging
    console.error('Error handler received:', {
      error: err,
      isInstance: err instanceof DatabaseError,
      type: typeof err,
      name: err?.name,
      code: err?.code,
      message: err?.message,
      statusCode: err?.statusCode,
      properties: err ? Object.getOwnPropertyNames(err) : [],
      prototype: err ? Object.getPrototypeOf(err) : null
    });

    // If error looks like a DatabaseError but instanceof check fails, reconstruct it
    if (!(err instanceof DatabaseError) && 
        typeof err === 'object' && 
        err !== null && 
        'code' in err &&
        typeof err.message === 'string' &&
        (err.code as DatabaseErrorCode) in statusCodeMap
    ) {
      console.log('Reconstructing DatabaseError from:', {
        originalError: err,
        code: err.code,
        message: err.message
      });
      
      // Create a new DatabaseError instance
      const newError = new DatabaseError(err.message, err.code as DatabaseErrorCode);
      
      // Copy all enumerable properties
      for (const prop in err) {
        if (!(prop in newError)) {
          (newError as any)[prop] = (err as any)[prop];
        }
      }
      
      // Copy non-enumerable properties
      Object.getOwnPropertyNames(err).forEach(prop => {
        if (!(prop in newError)) {
          Object.defineProperty(newError, prop, Object.getOwnPropertyDescriptor(err, prop)!);
        }
      });
      
      // Fix the prototype chain
      Object.setPrototypeOf(newError, DatabaseError.prototype);
      
      console.log('Reconstructed DatabaseError:', {
        newError,
        isInstance: newError instanceof DatabaseError,
        code: newError.code,
        statusCode: newError.statusCode
      });
      
      err = newError;
    }

    // Handle DatabaseErrors
    if (err instanceof DatabaseError) {
      switch (err.code) {
        case 'NOT_FOUND':
          return res.status(404).json({ error: err.message });
        case 'FORBIDDEN':
          return res.status(403).json({ error: err.message });
        case 'CONFLICT':
          return res.status(409).json({ error: err.message });
        case 'INVALID_INPUT':
          return res.status(400).json({ error: err.message });
        case 'INTERNAL_ERROR':
          console.error('Internal database error:', err);
          return res.status(500).json({ error: "Internal server error" });
        default:
          console.error('Unhandled DatabaseError code:', err.code);
          return res.status(500).json({ error: "Internal server error" });
      }
    }

    // If this is not a DatabaseError, pass it to the next error handler
    if (next) {
      return next(err);
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error('Unhandled error:', err);
    res.status(status).json({ error: message });
  });

  return { app, server };
};

export const startServer = async (app: Express, server: Server) => {
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = parseInt(process.env.PORT || '5001', 10);
  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  });
};

// Only start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const { app, server } = createApp();
  startServer(app, server);
}
