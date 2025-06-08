/**
 *  Module to manage the DAQ datastore with daqnode 
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
var SqliteDB = require("./sqlite");
var InfluxDB = require("./influxdb");
// var DaqNode = require('./daqnode');
var calculator = require('./calculator');
var utils = require('../utils');

var daqStoreType;

var settings;
var logger;
var daqDB = {};                 // list of daqDB node: SQlite one pro device, influxDB only one
var timeSerieDB;

function init(_settings, _log) {
    settings = _settings;
    logger = _log;
    logger.info("daqstorage: init successful!", true);
}

function reset() {
    daqStoreType = _getDbType();
    for (var id in daqDB) {
        daqDB[id].close();
    }
    daqDB = {};
    logger.info("daqstorage reset!", true);
}

function addDaqNode(_id, fncgetprop) {
    var id = _id;
    if (_getDbType() === DaqStoreTypeEnum.influxDB) {
        id = _getDbType();
    }
    if (!daqDB[id]) {
        daqDB[id] = id === DaqStoreTypeEnum.influxDB ? InfluxDB.create(settings, logger) : SqliteDB.create(settings, logger, id);
    }
    return daqDB[id].setCall(fncgetprop);
    // return daqnodes[id].addDaqValue;
}

function getNodeValues(tagid, fromts, tots) {
    return new Promise(function (resolve, reject) {
        var daqnode = _getDaqNode(tagid);
        if (daqnode) {
            resolve(daqnode.getDaqValue(tagid, fromts, tots));
        } else {
            resolve([]);
        }
    });
}

/**
 * Return tags values, 
 * if with options then return function array [{DD/MM/YYYY mm:HH, ...values}]
 * else for chart object {tagId} [{Date, value}]
 * @param {*} tagsid 
 * @param {*} fromts 
 * @param {*} tots 
 * @param {*} options 
 * @returns 
 */
function getNodesValues(tagsid, fromts, tots, options) {
    return new Promise(async function (resolve, reject) {
        try {
            var dbfncs = [];
            for (const element of tagsid) {
                dbfncs.push(await getNodeValues(element, fromts, tots));
            }
            Promise.all(dbfncs).then(values => {
                if (!values || values.length === 0) {    // (0)[]
                    resolve(['', ...tagsid.map(col => '')]);
                } else if (options) {
                    let calcValues = [];
                    for (const [idx, value] of values.entries()) {
                        if (options.functions[idx]) {
                            calcValues.push(calculator.getFunctionValues(value, fromts, tots, options.functions[idx], options.interval));
                        } else {
                            calcValues.push(calculator.getFunctionValues(value, fromts, tots));
                        }
                    }
                    let keys = Object.keys(calcValues[0]).map(Number);
                    let mergeValues = Object.keys(calcValues[0]).map(ts => [utils.getFormatDate(new Date(Number(ts))), _getValue(calcValues[0][ts])]);
                    for (let x = 1; x < calcValues.length; x++) {
                        let y = 0;
                        for (const k of keys) {
                            mergeValues[y++].push(_getValue(calcValues[x][k]));
                        }
                    }
                    resolve(mergeValues);
                } else {
                    var result = {};
                    for (const [i, element] of tagsid.entries()) {
                        result[element] = values[i].map(v => { return { x: new Date(v.dt), y: v.value} });
                        result[element].push({ x: new Date(tots), y: null});
                        result[element].unshift({ x: new Date(fromts), y: null});
                    }
                    resolve(result);
                }
            }, error => {
                reject(error);
            });
        } catch {
            reject(['ERR', ...tagsid.map(col => 'ERR')]);
        }
    });
}

function checkRetention() {
    return new Promise(async function (resolve, reject) {
        if (settings.daqstore && _getDbType() === DaqStoreTypeEnum.SQlite) {
            try {
                SqliteDB.checkRetention(_getRetentionLimit(settings.daqstore.retention), settings.dbDir, (err) => {
                    logger.error(`daqstorage.checkRetention remove file failed! ${err}`);
                });
            } catch (error) {
                logger.error(error);
            }
        }
        logger.info(`daqstorage.checkRetention processed`);
        resolve();
    });
}

function _getDaqNode(tagid) {
    var nodes = Object.values(daqDB);
    for (const node of nodes) {
        if (node.getDaqMap(tagid)[tagid]) {
            return node;
        }
    }
}

function _getDbType() {
    if (settings.daqstore && settings.daqstore) {
        return settings.daqstore.type;
    }
    return DaqStoreTypeEnum.SQlite;
}

var DaqStoreTypeEnum = {
    SQlite: 'SQlite',
    influxDB: 'influxDB',
}

function _getValue(value) {
    if (value == Number.MAX_VALUE || value == Number.MIN_VALUE) {
        return '';
    }
    return value.toString();
}

var _getRetentionLimit = function(retention) {
    var dayToAdd = 0;
    switch (retention) {
    case 'day1': {
        dayToAdd = 1;

    break;
    }
    case 'days2': {
        dayToAdd = 2;

    break;
    }
    case 'days3': {
        dayToAdd = 3;

    break;
    }
    case 'days7': {
        dayToAdd = 7;

    break;
    }
    case 'days14': {
        dayToAdd = 14;

    break;
    }
    case 'days30': {
        dayToAdd = 30;

    break;
    }
    case 'days90': {
        dayToAdd = 90;

    break;
    }
    case 'year1': {
        dayToAdd = 365;

    break;
    }
    // No default
    }
    const date = new Date();
    date.setDate(date.getDate() - dayToAdd);
    return date;
}

module.exports = {
    init: init,
    reset: reset,
    addDaqNode: addDaqNode,
    getNodeValues: getNodeValues,
    getNodesValues: getNodesValues,
    checkRetention: checkRetention,
};