/**
 * 'api/plugin': Plugin API to GET/POST plugin data
 */

var express = require("express");
const authJwt = require('../jwt-helper');
var runtime;
var secureFnc;
var checkGroupsFnc;

module.exports = {
    init: function (_runtime, _secureFnc, _checkGroupsFnc) {
        runtime = _runtime;
        secureFnc = _secureFnc;
        checkGroupsFnc = _checkGroupsFnc;
    },
    app: function () {
        var pluginsApp = express();
        pluginsApp.use(function (req, res, next) {
            if (runtime.project) {
                next();
            } else {
                res.status(404).end();
            }
        });

        /**
         * GET supported Plugin and status (installed) 
         */
        pluginsApp.get("/api/plugins", secureFnc, function (req, res) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get plugins: Tocken Expired");
            } else if (authJwt.adminGroups.includes(groups)) {
                runtime.plugins.getPlugins().then(result => {
                    // res.header("Access-Control-Allow-Origin", "*");
                    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                    if (result) {
                        res.json(result);
                    } else {
                        res.end();
                    }
                }).catch(function (error) {
                    if (error.code) {
                        res.status(400).json({ error: error.code, message: error.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: error.toString() });
                    }
                    runtime.logger.error("api get plugins: " + error.message);
                });
            } else {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api get plugins: Unauthorized!");
            }
        });

        /**
         * POST Plugin
         * Install the plugin
         */
        pluginsApp.post("/api/plugins", secureFnc, function (req, res, next) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post plugins: Tocken Expired");
            } else if (authJwt.adminGroups.includes(groups)) {
                runtime.plugins.addPlugin(req.body.params, true).then(function (data) {
                    runtime.devices.update();
                    res.end();
                }).catch(function (error) {
                    if (error.code) {
                        res.status(400).json({ error: error.code, message: error.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: error.toString() });
                    }
                    runtime.logger.error("api install plugins: " + error.message);
                });
            } else {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api post plugins: Unauthorized");
            }
        });

        /**
         * DELETE Plugin
         * Unistall the plugin
         */
        pluginsApp.delete("/api/plugins", secureFnc, function (req, res, next) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api delete plugins: Tocken Expired");
            } else if (authJwt.adminGroups.includes(groups)) {
                runtime.plugins.removePlugin(req.query.param).then(function (data) {
                    res.end();
                }).catch(function (error) {
                    if (error.code) {
                        res.status(400).json({ error: error.code, message: error.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: error.toString() });
                    }
                    runtime.logger.error("api delete plugins: " + error.message);
                });
            } else {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api delete plugins: Unauthorized");
            }
        });
        return pluginsApp;
    }
}