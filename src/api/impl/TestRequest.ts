
export default {
    url: "/test",
    requestType: "GET",
    method: async (req:any, res:any) => {
        return res.json({
            message: "CORS is working!",
            origin: req.headers.origin || "No origin"
        });
    }
}