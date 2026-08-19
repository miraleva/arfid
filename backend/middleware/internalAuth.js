/**
 * Internal Auth Middleware
 * Verifies that incoming requests contain a valid X-Internal-Token header.
 * Used to protect internal backend routes called by frontend proxies.
 */

/**
 * Middleware function to enforce internal shared secret authentication.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next middleware
 */
function verifyInternalToken(req, res, next) {
    const clientToken = req.get("X-Internal-Token");
    const validToken = process.env.INTERNAL_SHARED_SECRET;

    if (!validToken || clientToken !== validToken) {
        console.log(`[Security] Rejected request to ${req.originalUrl || req.path} from ${req.ip} - Invalid/Missing Token`);
        return res.status(403).json({ error: "Access Denied: Unauthorized Proxy" });
    }

    next();
}

module.exports = {
    verifyInternalToken
};
