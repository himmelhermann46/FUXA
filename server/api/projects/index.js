/**
 * 'api/project': Project API to GET/POST project data
 */

var express = require("express");
const authJwt = require('../jwt-helper');
const fs = require('node:fs');
const path = require('node:path');

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
        var prjApp = express();
        prjApp.use(function(req,res,next) {
            if (runtime.project) {
                next();
            } else {
                res.status(404).end();
            }
        });

        /**
         * GET Project data
         * Take from project storage and reply 
         */
        prjApp.get("/api/project", secureFnc, function(req, res) {
            var groups = checkGroupsFnc(req);
            runtime.project.getProject(req.userId, groups).then(result => {
                // res.header("Access-Control-Allow-Origin", "*");
                // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                if (result) {
                    res.json(result);
                } else {
                    res.status(404).end();
                    runtime.logger.error("api get project: Not Found!");
                }
            }).catch(function(error) {
                if (error && error.code) {
                    if (error.code !== 'ERR_HTTP_HEADERS_SENT') {
                        res.status(400).json({error:error.code, message: error.message});
                        runtime.logger.error("api get project: " + error.message);
                    }
                } else {
                    res.status(400).json({error:"unexpected_error", message: error});
                    runtime.logger.error("api get project: " + error);
                }
            });
        });

        /**
         * POST Project data
         * Set to project storage
         */
        prjApp.post("/api/project", secureFnc, function(req, res, next) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post project: Tocken Expired");
            } else if (authJwt.adminGroups.includes(groups) ) {
                runtime.project.setProject(req.body).then(function(data) {
                    runtime.restart(true).then(function(result) {
                        res.end();
                    });
                }).catch(function(error) {
                    if (error && error.code) {
                        res.status(400).json({error:error.code, message: error.message});
                        runtime.logger.error("api post project: " + error.message);
                    } else {
                        res.status(400).json({error:"unexpected_error", message: error});
                        runtime.logger.error("api post project: " + error);
                    }
                });
            } else {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post project: Unauthorized");
            }
        });

        /**
         * POST Single Project data
         * Set the value (general/view/device/...) to project storage
         */
        prjApp.post("/api/projectData", secureFnc, function(req, res, next) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post projectData: Tocken Expired");
            } else if (authJwt.adminGroups.includes(groups) ) {
                runtime.project.setProjectData(req.body.cmd, req.body.data).then(setres => {
                    runtime.update(req.body.cmd, req.body.data).then(result => {
                        res.end();
                    });
                }).catch(function(error) {
                    if (error && error.code) {
                        res.status(400).json({error:error.code, message: error.message});
                        runtime.logger.error("api post projectData: " + error.message);
                    } else {
                        res.status(400).json({error:"unexpected_error", message: error});
                        runtime.logger.error("api post projectData: " + error);
                    }
                });
            } else {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post projectData: Unauthorized");
            }
        });

        /**
         * GET Project demo data
         * Take the project demo file from server folder 
         */
        prjApp.get("/api/projectdemo", secureFnc, function (req, res) {
            const data = runtime.project.getProjectDemo();
            // res.header("Access-Control-Allow-Origin", "*");
            // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            if (data) {
                res.json(data);
            } else {
                res.status(404).end();
                runtime.logger.error("api get project: Not Found!");
            }
        });

        /**
         * GET Device property like security
         * Take from project storage and reply 
         */
        prjApp.get("/api/device", secureFnc, function(req, res) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get device: Tocken Expired");
            } else if (authJwt.adminGroups.includes(groups) ) {
                runtime.project.getDeviceProperty(req.query).then(result => {
                    // res.header("Access-Control-Allow-Origin", "*");
                    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                    if (result) {
                        res.json(result);
                    } else {
                        res.end();
                    }
                }).catch(function(error) {
                    if (error && error.code) {
                        res.status(400).json({error:error.code, message: error.message});
                        runtime.logger.error("api get device: " + error.message);
                    } else {
                        res.status(400).json({error:"unexpected_error", message: error});
                        runtime.logger.error("api get device: " + error);
                    }
                });
            } else {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api get device: Unauthorized");
            }
        });

        /**
         * POST Device property
         * Set to project storage
         */
        prjApp.post("/api/device", secureFnc, function(req, res, next) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post device: Tocken Expired");
            } else if (authJwt.adminGroups.includes(groups) ) {
                runtime.project.setDeviceProperty(req.body.params).then(function(data) {
                    res.end();
                }).catch(function(error) {
                    if (error && error.code) {
                        res.status(400).json({error:error.code, message: error.message});
                        runtime.logger.error("api post device: " + error.message);
                    } else {
                        res.status(400).json({error:"unexpected_error", message: error});
                        runtime.logger.error("api post device: " + error);
                    }
                });                
            } else {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post device: Unauthorized");
            }
        });

        /**
         * POST Upload file resource
         * images will be in media file saved
         */
        prjApp.post('/api/upload', function (req, res) {
            const file = req.body;
            try {
                let basedata = file.data;
                let encoding = {};
                // let basedata = file.data.replace(/^data:.*,/, '');
                // let basedata = file.data.replace(/^data:image\/png;base64,/, "");
                let fileName = file.name.replace(new RegExp('../', 'g'), '');
                const filePath = path.join(runtime.settings.uploadFileDir, fileName);
                if (file.type !== 'svg') {
                    basedata = file.data.replace(/^data:.*,/, '');
                    encoding = {encoding: 'base64'};
                }
                fs.writeFileSync(filePath, basedata, encoding);
                let result = {'location': '/' + runtime.settings.httpUploadFileStatic + '/' + fileName };
                res.json(result);
            } catch (error) {
                if (error && error.code) {
                    res.status(400).json({error: error.code, message: error.message});
                    runtime.logger.error("api upload: " + error.message);
                } else {
                    res.status(400).json({error:"unexpected_error", message: error});
                    runtime.logger.error("api upload: " + error);
                }
            }
        });

        return prjApp;
    }
}