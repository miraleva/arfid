/**
 * Dev Auth Middleware
 * Verifies X-Dev-Token header against DEV_TEST_TOKEN environment variable.
 * Protects internal development and testing endpoints.
 */

/**
 * Middleware function to enforce dev test token authentication.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next middleware
 */
function checkDevToken(req, res, next) {
    const clientDevToken = req.get("X-Dev-Token");
    const validDevToken = process.env.DEV_TEST_TOKEN;

    if (!validDevToken || !clientDevToken || clientDevToken !== validDevToken) {
        return res.status(401).json({ error: "Dev endpoint access denied: Invalid or missing X-Dev-Token" });
    }
    next();
}

module.exports = {
    checkDevToken
};
