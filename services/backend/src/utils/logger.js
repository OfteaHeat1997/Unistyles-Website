// ===========================================
// WINSTON LOGGER
// Structured logging with file rotation
// ===========================================

const { createLogger, format, transports } = require('winston');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../logs');

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.json()
    ),
    defaultMeta: { service: 'unistyles-api' },
    transports: [
        // Error log file
        new transports.File({
            filename: path.join(LOG_DIR, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Combined log file
        new transports.File({
            filename: path.join(LOG_DIR, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 5
        })
    ]
});

// In development, also log to console with colors
if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: format.combine(
            format.colorize(),
            format.printf(({ timestamp, level, message, service, ...meta }) => {
                const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
                return `${timestamp} [${level}] ${message}${metaStr}`;
            })
        )
    }));
} else {
    // In production, log info+ to console as JSON for Docker log drivers
    logger.add(new transports.Console({
        format: format.combine(format.timestamp(), format.json())
    }));
}

// Express middleware for request logging
function requestLogger(req, res, next) {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            requestId: req.requestId
        };

        if (res.statusCode >= 500) {
            logger.error('Request failed', logData);
        } else if (res.statusCode >= 400) {
            logger.warn('Client error', logData);
        } else {
            logger.info('Request completed', logData);
        }
    });

    next();
}

module.exports = { logger, requestLogger };
