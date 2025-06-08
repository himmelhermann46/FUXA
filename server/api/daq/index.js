/**
 * 'api/daq': DAQ API to GET/POST storage daq data
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
        var daqApp = express();
        daqApp.use(function (req, res, next) {
            if (runtime.project) {
                next();
            } else {
                res.status(404).end();
            }
        });
        
        /**
         * GET daq data
         * Take from daq storage data and reply 
         */
         daqApp.get("/api/daq", secureFnc, function(req, res) {
            try {
                if (req.query && req.query.query) {
                    var query = JSON.parse(req.query.query);
                    var dbfncs = [];
                    for (let i = 0; i < query.sids.length; i++) {
                        if (query.to === query.from) {  // current values
                            dbfncs.push([runtime.devices.getTagValue(query.sids[i], true)]);
                        } else {                        // from history
                            dbfncs.push(runtime.daqStorage.getNodeValues(query.sids[i], query.from, query.to));
                        }
                    }
                    if (query.to === query.from) {  // current values
                        res.json(dbfncs);
                    } else {
                        Promise.all(dbfncs).then(values => {
                            if (values) {
                                res.json(values);
                            } else {
                                res.status(404).end();
                                runtime.logger.error("api get daq: Not Found!");
                            }
                            // io.emit(Events.IoEventTypes.DAQ_RESULT, { gid: msg.gid, values: values });
                        }, error => {
                            if (error && error.stack) {
                                runtime.logger.error(`api get daq: Not Found!: ${error.stack}`);
                                res.status(400).json({error:"unexpected_error", message: error.stack});
                            } else {
                                runtime.logger.error(`api get daq: Not Found!: ${error}`);
                                res.status(400).json({error:"unexpected_error", message: error});
                            }
                        });
                    }
                } else {
                    res.status(404).end();
                    runtime.logger.error("api get daq: Not Found!");
                }
            } catch (error) {
                if (error && error.code) {
                    res.status(400).json({error:error.code, message: error.message});
                } else {
                    res.status(400).json({error:"unexpected_error", message:error.toString()});
                }
                runtime.logger.error("api get daq: " + error.message);
            }
        });
        return daqApp;
    }
}