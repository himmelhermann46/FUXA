/*
* Project manager: read, write, add, remove, ... and save 
*/

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const async = require('async');

var events = require('../events');
var utils = require('../utils');
const prjstorage = require('./prjstorage');
const DeviceType = require('../devices/device').DeviceType;

const version = '1.02';
var settings;                   // Application settings
var logger;                     // Application logger

var data = {};                  // Project data

/**
 * Init Project resource and update project
 * @param {*} _settings 
 * @param {*} log 
 */
function init(_settings, log) {
    settings = _settings;
    logger = log;

    // Init Project database
    return new Promise(function (resolve, reject) {
        prjstorage.init(settings, logger).then(result => {
            logger.info('project.prjstorage-init-successful!', true);
            if (result) {
                resolve();
            } else {
                prjstorage.setDefault().then(result => {
                    logger.info('project.prjstorage-set-default-successful!', true);
                    resolve();
                }).catch(function (error) {
                    logger.error(`project.prjstorage-set-default failed! ${error}`);
                    resolve();
                });
            }
        }).catch(function (error) {
            logger.error(`project.prjstorage-failed-to-init! ${error}`);
            reject(error);
        });
    });
}

/**
 * Load project resource in a local data
 * Read all storaged sections and fill in local data
 */
function load() {
    return new Promise(function (resolve, reject) {
        data = { devices: {}, hmi: { views: [] }, texts: [], alarms: [] };
        // load general data
        prjstorage.getSection(prjstorage.TableType.GENERAL).then(grows => {
            for (const grow of grows) {
                if (grow.name === ProjectDataCmdType.HmiLayout) {
                    data.hmi[grow.name] = JSON.parse(grow.value);
                } else {
                    data[grow.name] = JSON.parse(grow.value);
                }
            }
            // load views
            prjstorage.getSection(prjstorage.TableType.VIEWS).then(vrows => {
                for (const vrow of vrows) {
                    data.hmi.views.push(JSON.parse(vrow.value));
                }
                // load devices
                prjstorage.getSection(prjstorage.TableType.DEVICES).then(drows => {
                    for (const drow of drows) {
                        if (drow.name === 'server') {
                            data[drow.name] = JSON.parse(drow.value);
                        } else {
                            data.devices[drow.name] = JSON.parse(drow.value);
                        }
                    }
                    async.series([
                        // step 1 get texts
                        function (callback) {
                            getTexts().then(texts => {
                                data.texts = texts;
                                callback();
                            }).catch(function (error) {
                                logger.error(`project.prjstorage-failed-to-load! '${prjstorage.TableType.TEXTS}' ${error}`);
                                callback(error);
                            });
                        },
                        // step 2 get alarms
                        function (callback) {
                            getAlarms().then(alarms => {
                                data.alarms = alarms;
                                callback();
                            }).catch(function (error) {
                                logger.error(`project.prjstorage-failed-to-load! '${prjstorage.TableType.ALARMS}' ${error}`);
                                callback(error);
                            });
                        },
                        // step 3 get notifications
                        function (callback) {
                            getNotifications().then(notifications => {
                                data.notifications = notifications;
                                callback();
                            }).catch(function (error) {
                                logger.error(`project.prjstorage-failed-to-load! '${prjstorage.TableType.NOTIFICATIONS}' ${error}`);
                                callback(error);
                            }); 
                        },
                        // step 4 get scripts
                        function (callback) {
                            getScripts().then(scripts => {
                                data.scripts = scripts;
                                callback();
                            }).catch(function (error) {
                                logger.error(`project.prjstorage-failed-to-load! '${prjstorage.TableType.SCRIPTS}' ${error}`);
                                callback(error);
                            });
                        },
                        // step 5 get reports
                        function (callback) {
                            getReports().then(reports => {
                                data.reports = reports;
                                callback();
                            }).catch(function (error) {
                                logger.error(`project.prjstorage-failed-to-load! '${prjstorage.TableType.REPORTS}' ${error}`);
                                callback(error);
                            }); 
                        }
                    ],
                    async function (err) {
                        if (err) {
                            reject(err);
                        } else {
                            await _mergeDefaultConfig();
                            resolve();
                        }
                    });
                }).catch(function (error) {
                    logger.error(`project.prjstorage-failed-to-load! '${prjstorage.TableType.DEVICES}' ${error}`);
                    reject(error);
                });
            }).catch(function (error) {
                logger.error(`project.prjstorage-failed-to-load! '${prjstorage.TableType.VIEWS}' ${error}`);
                reject(error);
            });
        }).catch(function (error) {
            logger.error(`project.prjstorage-failed-to-load! '${prjstorage.TableType.GENERAL}' ${error}`);
            reject(error);
        });
    });
}

/**
 * Save the value in project storage
 * First set the value in local data, then save in storage
 * @param {*} cmd 
 * @param {*} data 
 */
function setProjectData(cmd, value) {
    return new Promise(function (resolve, reject) {
        try {
            var toremove = false;
            var section = { table: '', name: '', value: value };
            switch (cmd) {
            case ProjectDataCmdType.SetView: {
                section.table = prjstorage.TableType.VIEWS;
                section.name = value.id;
                setView(value);

            break;
            }
            case ProjectDataCmdType.DelView: {
                section.table = prjstorage.TableType.VIEWS;
                section.name = value.id;
                toremove = removeView(value);

            break;
            }
            case ProjectDataCmdType.HmiLayout: {
                section.table = prjstorage.TableType.GENERAL;
                section.name = cmd;
                setHmiLayout(value);

            break;
            }
            case ProjectDataCmdType.SetDevice: {
                section.table = prjstorage.TableType.DEVICES;
                section.name = value.id;
                setDevice(value);

            break;
            }
            case ProjectDataCmdType.DelDevice: {
                section.table = prjstorage.TableType.DEVICES;
                section.name = value.id;
                toremove = removeDevice(value);

            break;
            }
            case ProjectDataCmdType.Charts: {
                section.table = prjstorage.TableType.GENERAL;
                section.name = cmd;
                setCharts(value);

            break;
            }
            case ProjectDataCmdType.Graphs: {
                section.table = prjstorage.TableType.GENERAL;
                section.name = cmd;
                setGraphs(value);

            break;
            }
            case ProjectDataCmdType.SetText: {
                section.table = prjstorage.TableType.TEXTS;
                section.name = value.name;
                setText(value);

            break;
            }
            case ProjectDataCmdType.DelText: {
                section.table = prjstorage.TableType.TEXTS;
                section.name = value.name;
                toremove = removeText(value);

            break;
            }
            case ProjectDataCmdType.SetAlarm: {
                section.table = prjstorage.TableType.ALARMS;
                section.name = value.name;
                setAlarm(value);

            break;
            }
            case ProjectDataCmdType.DelAlarm: {
                section.table = prjstorage.TableType.ALARMS;
                section.name = value.name;
                toremove = removeAlarm(value);

            break;
            }
            case ProjectDataCmdType.SetNotification: {
                section.table = prjstorage.TableType.NOTIFICATIONS;
                section.name = value.id;
                setNotification(value);

            break;
            }
            case ProjectDataCmdType.DelNotification: {
                section.table = prjstorage.TableType.NOTIFICATIONS;
                section.name = value.id;
                toremove = removeNotification(value);

            break;
            }
            case ProjectDataCmdType.SetScript: {
                section.table = prjstorage.TableType.SCRIPTS;
                section.name = value.id;
                setScript(value);

            break;
            }
            case ProjectDataCmdType.DelScript: {
                section.table = prjstorage.TableType.SCRIPTS;
                section.name = value.id;
                toremove = removeScript(value);

            break;
            }
            case ProjectDataCmdType.SetReport: {
                section.table = prjstorage.TableType.REPORTS;
                section.name = value.id;
                setReport(value);

            break;
            }
            case ProjectDataCmdType.DelReport: {
                section.table = prjstorage.TableType.REPORTS;
                section.name = value.id;
                toremove = removeReport(value);

            break;
            }
            default: {
                logger.error(`prjstorage.setdata failed! '${section.table}'`);
                reject('prjstorage.failed-to-setdata: Command not found!');    
            }
            }
            if (toremove) {
                prjstorage.deleteSection(section).then(result => {
                    resolve(true);
                }).catch(function (error) {
                    logger.error(`prjstorage.deletedata failed! '${section.table}'`);
                    reject(error);
                });
            } else {
                prjstorage.setSection(section).then(result => {
                    resolve(true);
                }).catch(function (error) {
                    logger.error(`prjstorage.setdata failed! '${section.table}'`);
                    reject(error);
                });
            }
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Set or add if not exist (check with view.id) the View in Project
 * @param {*} view 
 */
function setView(view) {
    var pos = -1;
    for (var i = 0; i < data.hmi.views.length; i++) {
        if (data.hmi.views[i].id === view.id) {
            pos = i;
        }
    }
    if (pos >= 0) {
        data.hmi.views[pos] = view;
    } else {
        data.hmi.views.push(view);
    }
}

/**
 * Remove the View from Project
 * @param {*} view 
 */
function removeView(view) {
    var pos = -1;
    for (var i = 0; i < data.hmi.views.length; i++) {
        if (data.hmi.views[i].id === view.id) {
            data.hmi.views.splice(i, 1);
            return true;
        }
    }
    return false;
}

/**
 * Set Device to local data
 * @param {*} device 
 * @param {*} merge merge with exist (tags)
 */
function setDevice(device, merge) {
    if (merge && data.devices[device.id]) {
        device.enabled = data.devices[device.id].enabled;
        data.devices[device.id] = {...data.devices[device.id], ...device};
    } else {
        data.devices[device.id] = device;
    }
}

/**
 * Remove Device from local data
 * @param {*} device 
 */
function removeDevice(device) {
    delete data.devices[device.id];
    return true;
}

/**
 * Set HMI Layout to local data
 * @param {*} layout 
 */
function setHmiLayout(layout) {
    data.hmi.layout = layout;
}

/**
 * Set Charts  
 * @param {*} charts 
 */
function setCharts(charts) {
    data.charts = charts;
}

/**
 * Set Graphs  
 * @param {*} graphs 
 */
 function setGraphs(graphs) {
    data.graphs = graphs;
}

/**
 * Set or add if not exist (check with taxt.name) the Text in Project
 * @param {*} text 
 */
function setText(text) {
    if (!data.texts) {
        data.texts = [];
    }
    var pos = -1;
    for (var i = 0; i < data.texts.length; i++) {
        if (data.texts[i].name === text.name) {
            pos = i;
        }
    }
    if (pos >= 0) {
        data.texts[pos] = text;
    } else {
        data.texts.push(text);
    }
}

/**
 * Remove the Text from Project
 * @param {*} text 
 */
function removeText(text) {
    if (data.texts) {
        var pos = -1;
        for (var i = 0; i < data.texts.length; i++) {
            if (data.texts[i].name === text.name) {
                data.texts.splice(i, 1);
                return true;
            }
        }
    }
    return false;
}

/**
 * Set or add if not exist (check with alarm.name) the Alarm in Project
 * @param {*} alarm 
 */
function setAlarm(alarm) {
    if (!data.alarms) {
        data.alarms = [];
    }
    var pos = -1;
    for (var i = 0; i < data.alarms.length; i++) {
        if (data.alarms[i].name === alarm.name) {
            pos = i;
        }
    }
    if (pos >= 0) {
        data.alarms[pos] = alarm;
    } else {
        data.alarms.push(alarm);
    }
}

/**
 * Remove the Alarm from Project
 * @param {*} alarm 
 */
function removeAlarm(alarm) {
    if (data.alarms) {
        var pos = -1;
        for (var i = 0; i < data.alarms.length; i++) {
            if (data.alarms[i].name === alarm.name) {
                data.alarms.splice(i, 1);
                return true;
            }
        }
    }
    return false;
}

/**
 * Set or add if not exist (check with notification.id) the Notification in Project
 * @param {*} notification 
 */
 function setNotification(notification) {
    if (!data.notifications) {
        data.notifications = [];
    }
    var pos = -1;
    for (var i = 0; i < data.notifications.length; i++) {
        if (data.notifications[i].id === notification.id) {
            pos = i;
        }
    }
    if (pos >= 0) {
        data.notifications[pos] = notification;
    } else {
        data.notifications.push(notification);
    }
}

/**
 * Remove the Notification from Project
 * @param {*} notification 
 */
function removeNotification(notification) {
    if (data.notifications) {
        var pos = -1;
        for (var i = 0; i < data.notifications.length; i++) {
            if (data.notifications[i].id === notification.id) {
                data.notifications.splice(i, 1);
                return true;
            }
        }
    }
    return false;
}

/**
 * Set or add if not exist (check with script.id) the Script in Project
 * @param {*} script 
 */
 function setScript(script) {
    if (!data.scripts) {
        data.scripts = [];
    }
    var pos = -1;
    for (var i = 0; i < data.scripts.length; i++) {
        if (data.scripts[i].id === script.id) {
            pos = i;
        }
    }
    if (pos >= 0) {
        data.scripts[pos] = script;
    } else {
        data.scripts.push(script);
    }
}

/**
 * Remove the Script from Project
 * @param {*} script 
 */
 function removeScript(script) {
    if (data.scripts) {
        var pos = -1;
        for (var i = 0; i < data.scripts.length; i++) {
            if (data.scripts[i].id === script.id) {
                data.scripts.splice(i, 1);
                return true;
            }
        }
    }
    return false;
}

/**
 * Set or add if not exist (check with report.id) the Report in Project
 * @param {*} report 
 */
 function setReport(report) {
    if (!data.reports) {
        data.reports = [];
    }
    var pos = -1;
    for (var i = 0; i < data.reports.length; i++) {
        if (data.reports[i].id === report.id) {
            pos = i;
        }
    }
    if (pos >= 0) {
        data.reports[pos] = report;
    } else {
        data.reports.push(report);
    }
}

/**
 * Remove the Report from Project
 * @param {*} script 
 */
 function removeReport(report) {
    if (data.reports) {
        var pos = -1;
        for (var i = 0; i < data.reports.length; i++) {
            if (data.reports[i].id === report.id) {
                data.reports.splice(i, 1);
                return true;
            }
        }
    }
    return false;
}

/**
 * Get the project data in accordance with autorization
 */
function getProject(userId, userGroups) {
    return new Promise(function (resolve, reject) {
        const pdata = _filterProjectGroups(userGroups);
        resolve(pdata);
    });
}

/**
 * Set the new Project, clear all from database and add the new content
 * @param {*} prjcontent 
 */
function setProject(prjcontent) {
    return new Promise(function (resolve, reject) {
        try {
            prjstorage.clearAll().then(result => {
                var scs = [];
                for (const key of Object.keys(prjcontent)) {
                    switch (key) {
                    case 'devices': {
                        // devices
                        var devices = prjcontent[key];
                        if (devices) {
                            for (const device of Object.values(prjcontent[key])) {
                                scs.push({ table: prjstorage.TableType.DEVICES, name: device.id, value: device });
                            }
                        }

                    break;
                    }
                    case 'hmi': {
                        // hmi
                        var hmi = prjcontent[key];
                        if (hmi) {
                            for (const hk of Object.keys(hmi)) {
                                if (hk === 'views') {
                                    // views
                                    if (hmi[hk] && hmi[hk].length > 0) {
                                        for (var i = 0; i < hmi[hk].length; i++) {
                                            var view = hmi[hk][i];
                                            scs.push({ table: prjstorage.TableType.VIEWS, name: view.id, value: view });
                                        }
                                    }
                                } else {
                                    // layout
                                    scs.push({ table: prjstorage.TableType.GENERAL, name: hk, value: hmi[hk] });
                                }
                            }
                        }

                    break;
                    }
                    case 'server': {
                        // server
                        scs.push({ table: prjstorage.TableType.DEVICES, name: key, value: prjcontent[key] });

                    break;
                    }
                    case 'texts': {
                        // texts
                        var texts = prjcontent[key];
                        if (texts && texts.length > 0) {
                            for (var i = 0; i < texts.length; i++) {
                                scs.push({ table: prjstorage.TableType.TEXTS, name: texts[i].name, value: texts[i] });
                            }
                        }

                    break;
                    }
                    case 'alarms': {
                        // alarms
                        var alarms = prjcontent[key];
                        if (alarms && alarms.length > 0) {
                            for (var i = 0; i < alarms.length; i++) {
                                scs.push({ table: prjstorage.TableType.ALARMS, name: alarms[i].name, value: alarms[i] });
                            }
                        }

                    break;
                    }
                    case 'notifications': {
                        // notifications
                        var notifications = prjcontent[key];
                        if (notifications && notifications.length > 0) {
                            for (var i = 0; i < notifications.length; i++) {
                                scs.push({ table: prjstorage.TableType.NOTIFICATIONS, name: notifications[i].id, value: notifications[i] });
                            }
                        }

                    break;
                    }
                    case 'scripts': {
                        // scripts
                        var scripts = prjcontent[key];
                        if (scripts && scripts.length > 0) {
                            for (var i = 0; i < scripts.length; i++) {
                                scs.push({ table: prjstorage.TableType.SCRIPTS, name: scripts[i].id, value: scripts[i] });
                            }
                        }

                    break;
                    }
                    case 'reports': {
                        // reports
                        var reports = prjcontent[key];
                        if (reports && reports.length > 0) {
                            for (var i = 0; i < reports.length; i++) {
                                scs.push({ table: prjstorage.TableType.REPORTS, name: reports[i].id, value: reports[i] });
                            }
                        }

                    break;
                    }
                    default: {
                        // charts, graphs, version
                        scs.push({ table: prjstorage.TableType.GENERAL, name: key, value: prjcontent[key] });
                    }
                    }
                }
                prjstorage.setSections(scs).then(() => {
                    logger.info(`project.prjstorage.set-project successfull!`, true);
                    resolve(true);
                }).catch(function (error) {
                    reject(error);
                });
            }).catch(function (error) {
                logger.error(`project.prjstorage.clear failed! '${error}'`);
                reject(error);
            });
        } catch {
            reject();
        }
    });
}

/**
 * Return Devices list
 */
function getDevices() {
    return data.devices;
}

/**
 * Get the device property
 */
function getDeviceProperty(query) {
    return new Promise(function (resolve, reject) {
        if (query.query === 'security') {
            prjstorage.getSection(prjstorage.TableType.DEVICESSECURITY, query.name).then(drows => {
                if (drows.length > 0) {
                    resolve(drows[0]);
                } else {
                    resolve();
                }
            }).catch(function (error) {
                logger.error(`project.prjstorage.getdevice-property failed! '${prjstorage.TableType.DEVICESSECURITY} ${error}'`);
                reject(error);
            });
        } else {
            reject();
        }
    });
}

/**
 * Get the texts 
 */
function getTexts() {
    return new Promise(function (resolve, reject) {
        prjstorage.getSection(prjstorage.TableType.TEXTS).then(drows => {
            if (drows.length > 0) {
                var texts = [];
                for (const drow of drows) {
                    texts.push(JSON.parse(drow.value));
                }
                resolve(texts);
            } else {
                resolve();
            }
        }).catch(function (error) {
            logger.error(`project.prjstorage.get-texts failed! '${prjstorage.TableType.TEXTS} ${error}'`);
            reject(error);
        });
    });
}

/**
 * Get the alarms 
 */
function getAlarms() {
    return new Promise(function (resolve, reject) {
        prjstorage.getSection(prjstorage.TableType.ALARMS).then(drows => {
            if (drows.length > 0) {
                var alarms = [];
                for (const drow of drows) {
                    alarms.push(JSON.parse(drow.value));
                }
                resolve(alarms);
            } else {
                resolve();
            }
        }).catch(function (error) {
            logger.error(`project.prjstorage.get-alarms failed! '${prjstorage.TableType.ALARMS} ${error}'`);
            reject(error);
        });
    });
}

/**
 * Get the notifications 
 */
 function getNotifications() {
    return new Promise(function (resolve, reject) {
        prjstorage.getSection(prjstorage.TableType.NOTIFICATIONS).then(drows => {
            if (drows.length > 0) {
                var notifications = [];
                for (const drow of drows) {
                    notifications.push(JSON.parse(drow.value));
                }
                resolve(notifications);
            } else {
                resolve();
            }
        }).catch(function (error) {
            logger.error(`project.prjstorage.get-notifications failed! '${prjstorage.TableType.NOTIFICATIONS} ${error}'`);
            reject(error);
        });
    });
}

/**
 * Get the scripts 
 */
 function getScripts() {
    return new Promise(function (resolve, reject) {
        prjstorage.getSection(prjstorage.TableType.SCRIPTS).then(drows => {
            if (drows.length > 0) {
                var scripts = [];
                for (const drow of drows) {
                    scripts.push(JSON.parse(drow.value));
                }
                resolve(scripts);
            } else {
                resolve();
            }
        }).catch(function (error) {
            logger.error(`project.prjstorage.get-scripts failed! '${prjstorage.TableType.SCRIPTS} ${error}'`);
            reject(error);
        });
    });
}

/**
 * Get the reports 
 */
 function getReports() {
    return new Promise(function (resolve, reject) {
        prjstorage.getSection(prjstorage.TableType.REPORTS).then(drows => {
            if (drows.length > 0) {
                var reports = [];
                for (const drow of drows) {
                    reports.push(JSON.parse(drow.value));
                }
                resolve(reports);
            } else {
                resolve();
            }
        }).catch(function (error) {
            logger.error(`project.prjstorage.get-reports failed! '${prjstorage.TableType.REPORTS} ${error}'`);
            reject(error);
        });
    });
}

/**
 * Set the device property
 */
function setDeviceProperty(query) {
    return new Promise(function (resolve, reject) {
        if (query.query === 'security') {
            prjstorage.setSection({ table: prjstorage.TableType.DEVICESSECURITY, name: query.name, value: query.value }).then(() => {
                resolve();
            }).catch(function (error) {
                logger.error(`project.prjstorage.setdevice-property failed! '${prjstorage.TableType.DEVICESSECURITY} ${error}'`);
                reject(error);
            });
        } else {
            reject();
        }
    });
}

/**
 * Return Project demo from file
 */
function getProjectDemo() {
    var demoProject = path.join(settings.appDir, 'project.demo.fuxap');
    return JSON.parse(fs.readFileSync(demoProject, 'utf8'));
}

function _filterProjectGroups(groups) {
    var result = JSON.parse(JSON.stringify(data));// = { devices: {}, hmi: { views: [] } };
    var admin = (groups === -1 || groups === 255) ? true : false;
    if (!admin) {
        // from device remove the not used (no permission)
        // delete result.devices;
        delete result.server;
        // check navigation permission
        if (result.hmi.layout && result.hmi.layout.navigation.items) {
            for (var i = result.hmi.layout.navigation.items.length - 1; i >= 0; i--) {
                var permission = result.hmi.layout.navigation.items[i].permission;
                if (permission && !(permission & groups)) {
                    result.hmi.layout.navigation.items.splice(i, 1);
                }
            }
        }
        // check view item permission show / enabled
        for (var i = 0; i < result.hmi.views.length; i++) {
            if (result.hmi.views[i].items) {
                for (const item of Object.values(result.hmi.views[i].items)) {
                    if (item.property && item.property.permission) {
                        var view = result.hmi.views[i];
                        var mask = (item.property.permission >> 8);
                        var show = (mask) ? mask & groups : 1;
                        mask = (item.property.permission & 255);
                        var enabled = (mask) ? mask & groups : 1;
                        if (!show) {
                            var position = view.svgcontent.indexOf(item.id);
                            if (position >= 0) {
                                position += item.id.length + 1;
                                var hidetext = ' visibility="hidden" ';
                                view.svgcontent = view.svgcontent.slice(0, position) + hidetext + view.svgcontent.slice(position);
                            }
                        } else if (!enabled) {
                            item.property.events = [];
                            // disable the html controls (select, input, button)
                            var splitted = utils.domStringSplitter(view.svgcontent, 'foreignobject', view.svgcontent.indexOf(item.id));
                            if (splitted.tagcontent && splitted.tagcontent.length > 0) {
                                var disabled = utils.domStringSetAttribute(splitted.tagcontent, ['select', 'input', 'button'], 'disabled');
                                view.svgcontent = splitted.before + disabled + splitted.after;
                            }
                        }
                    }
                }
            }
        }
    }
    return result;
}

function _mergeDefaultConfig() {
    return new Promise(async function (resolve, reject) {
        try {
            if (process.env.DEVICES && typeof process.env.DEVICES === 'string') {
                try {
                    logger.info('project.merge-config: in progress!');
                    var devices = JSON.parse(process.env.DEVICES);
                    for (const device of devices) {
                        try {
                            // check device required
                            if (!device || !device.id || !device.name || !device.type || !device.configs) {
                                logger.error(`project.merge-config: DEVICES${JSON.stringify(device)} missing property!`);
                            } else {
                                var existDevice = data.devices[device.id];
                                var deviceToAdd = new Device(device);
                                if (existDevice) {
                                    deviceToAdd.tags = existDevice.tags;
                                }
                                setDevice(deviceToAdd, true);
                                logger.info(`project.merge-config: Device ${deviceToAdd.name} added!`);    
                            }
                        } catch (error) {
                            logger.error(`project.merge-config: DEVICES${JSON.stringify(device)} failed! ${error}`);
                            reject();
                        }                            
                    }
                } catch (error) {
                    logger.error(`project.merge-config: DEVICES failed! ${error}`);
                }
            }
            resolve();
        } catch (error) {
            logger.error(`project.merge-config: failed! ${error}`);
            reject();
        }
    });

    function Device(device, tags) {
        this.id = device.id;
        this.name = device.name;
        this.enabled = true;
        this.type = device.type;
        this.polling = 1000 || device.configs.requestIntervalMs;
        this.tags = tags || {};
        this.property = device.configs;

        var a = Object.values(DeviceType);
        if (!Object.values(DeviceType).includes(device.type)) {
            throw new Error('DeviceType unknow');
        }
    }
}

const ProjectDataCmdType = {
    SetDevice: 'set-device',
    DelDevice: 'del-device',
    SetView: 'set-view',
    DelView: 'del-view',
    HmiLayout: 'layout',
    Charts: 'charts',
    Graphs: 'graphs',
    SetText: 'set-text',
    SetText: 'set-text',
    DelText: 'del-text',
    SetAlarm: 'set-alarm',
    DelAlarm: 'del-alarm',
    SetNotification: 'set-notification',
    DelNotification: 'del-notification',
    SetScript: 'set-script',
    DelScript: 'del-script',
    SetReport: 'set-report',
    DelReport: 'del-report',
}

module.exports = {
    init: init,
    load: load,
    getDevices: getDevices,
    getAlarms: getAlarms,
    getNotifications: getNotifications,
    getScripts: getScripts,
    getReports: getReports,
    getDeviceProperty: getDeviceProperty,
    setDeviceProperty: setDeviceProperty,
    setProjectData: setProjectData,
    getProject: getProject,
    setProject: setProject,
    getProjectDemo: getProjectDemo,
    ProjectDataCmdType, ProjectDataCmdType,
};
