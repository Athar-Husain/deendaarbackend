import express from "express";

/* =======================
   Security Middleware
======================= */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
  }),
);




/* =======================
   CORS
======================= */

console.log("process.env.CORS_ORIGIN", process.env.CORS_ORIGIN)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(","),
    credentials: true,
  }),
);

/* =======================
   Rate Limiting
======================= */
app.use("/api", genericLimiter);

/* =======================
   Parsers
======================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

/* =======================
   Security
======================= */
// app.use(mongoSanitize());
app.use(compression());

/* =======================
   Logging
======================= */
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    }),
  );
}



/* =======================
   Health Check
======================= */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

