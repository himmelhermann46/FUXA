/**
 * 'api/users': Users API to GET/POST users data
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
    app: function() {
        var usersApp = express();
        usersApp.use(function(req,res,next) {
            if (runtime.project) {
                next();
            } else {
                res.status(404).end();
            }
        });

        /**
         * GET Users
         * Take from users storage and reply 
         */
        usersApp.get("/api/users", secureFnc, function(req, res) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get users: Tocken Expired");
            } else if (authJwt.adminGroups.includes(groups) ) {
                runtime.users.getUsers(req.query).then(result => {
                    // res.header("Access-Control-Allow-Origin", "*");
                    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                    if (result) {
                        res.json(result);
                    } else {
                        res.end();
                    }
                }).catch(function(error) {
                    if (error.code) {
                        res.status(400).json({error:error.code, message: error.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:error.toString()});
                    }
                    runtime.logger.error("api get users: " + error.message);
                });                
            } else {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api get users: Unauthorized!");
            }
        });

        /**
         * POST Users
         * Set to users storage
         */
        usersApp.post("/api/users", secureFnc, function(req, res, next) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post users: Tocken Expired");
            } else if (authJwt.adminGroups.includes(groups) ) {
                runtime.users.setUsers(req.body.params).then(function(data) {
                    res.end();
                }).catch(function(error) {
                    if (error.code) {
                        res.status(400).json({error:error.code, message: error.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:error.toString()});
                    }
                    runtime.logger.error("api post users: " + error.message);
                });                
            } else {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post users: Unauthorized");
            }
        });
        
        /**
         * DELETE User
         * Set to project storage
         */
        usersApp.delete("/api/users", secureFnc, function(req, res, next) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api delete users: Tocken Expired");
            } else if (authJwt.adminGroups.includes(groups) ) {
                runtime.users.removeUsers(req.query.param).then(function(data) {
                    res.end();
                }).catch(function(error) {
                    if (error.code) {
                        res.status(400).json({error:error.code, message: error.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:error.toString()});
                    }
                    runtime.logger.error("api delete users: " + error.message);
                });                
            } else {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api delete users: Unauthorized");
            }
        });   
        return usersApp;
    }
}