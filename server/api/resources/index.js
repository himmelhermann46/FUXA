/**
 * 'api/resources': Diagnose API to GET resources: images
 */

const fs = require('node:fs');
const path = require('node:path');
var express = require("express");
const authJwt = require('../jwt-helper');
const Report = require('../../runtime/jobs/report');

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
        var resourcesApp = express();
        resourcesApp.use(function (req, res, next) {
            if (runtime.project) {
                next();
            } else {
                res.status(404).end();
            }
        });

        /**
         * GET Server logs folder content
         */
        resourcesApp.get('/api/resources/images', secureFnc, function (req, res) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get resources/images: Tocken Expired");
            } else if (authJwt.adminGroups.includes(groups)) {
                try {
                    var result = {...req.query,  groups: [] };
                    var resourcesDirs = getDirectories(runtime.settings.imagesFileDir);
                    for (const resourcesDir of resourcesDirs) {
                        var group = { name: resourcesDir, items: [] };
                        var dirPath = path.resolve(runtime.settings.imagesFileDir, resourcesDir);
                        var wwwSubDir =  path.join('_images', resourcesDir);
                        var files =  getFiles(dirPath, ['.jpg','.jpeg', '.png', '.gif', '.svg']);
                        for (const file of files) {
                            var filename = file.replace(/\.[^./]+$/, '');
                            group.items.push({ path:  path.join(wwwSubDir, file).split(path.sep).join(path.posix.sep), name: filename });
                        }
                        result.groups.push(group);
                    }
                    res.json(result);
                } catch (error) {
                    if (error.code) {
                        res.status(400).json({ error: error.code, message: error.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: error.toString() });
                    }
                    runtime.logger.error("api get resources/images: " + error.message);
                }
            } else {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api get resources/images: Unauthorized!");
            }
        });

        /**
         * GET svg/canvas rendered and converted to image
         */
        resourcesApp.get('/api/resources/generateImage', secureFnc, function (req, res) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get resources/generateImage: Tocken Expired");
            } else if (authJwt.adminGroups.includes(groups)) {
                try {
                    var query = JSON.parse(req.query.param);
                    const report = Report.create(null, runtime);
                    report.getChartImage(query).then((content) => {
                        res.end(content.toString('base64'));
                    }).catch(function (error) {
                        if (error.code) {
                            res.status(400).json({ error: error.code, message: error.message });
                        } else {
                            res.status(400).json({ error: "unexpected_error", message: error.toString() });
                        }
                        runtime.logger.error("createImage: " + error.message);
                    });
                } catch (error) {
                    if (error.code) {
                        res.status(400).json({ error: error.code, message: error.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: error.toString() });
                    }
                    runtime.logger.error("api get resources/generateImage: " + error.message);
                }
            } else {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api get resources/generateImage: Unauthorized!");
            }
        });

        return resourcesApp;
    }
}

function getDirectories (pathDir) {
    const directoriesInDIrectory = fs.readdirSync(pathDir, { withFileTypes: true })
        .filter((item) => item.isDirectory())
        .map((item) => item.name);
    return directoriesInDIrectory;
}

function getFiles (pathDir, extensions) {
    const filesInDIrectory = fs.readdirSync(pathDir)
        .filter((item) => extensions.includes(path.extname(item).toLowerCase()));
    return filesInDIrectory;
}
