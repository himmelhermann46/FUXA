/**
 *  Calculator for DAQ value array (integrale, max, min, average...) 
 */

'use strict';

const utils = require("../utils");

function getFunctionValues(values, fromts, tots, fnc, interval) {
    switch (fnc) {
    case ReportFunctionType.min: {
        return getMin(values, fromts, tots, interval);
    }
    case ReportFunctionType.max: {
        return getMax(values, fromts, tots, interval);
    }
    case ReportFunctionType.average: {
        return getAverage(values, fromts, tots, interval);
    }
    case ReportFunctionType.sum: {
        return getSum(values, fromts, tots, interval);
    }
    // No default
    }
}

/**
 * 
 * @param {*} values 
 * @param {*} fnc 
 * @param {*} intervalType hour / day 
 * @returns 
 */
function getMin(timeserie, fromts, tots, intervalType) {
    let result = getInterval(fromts, tots, intervalType, Number.MAX_VALUE);
    // sort to start with the oldest
    let sorted = timeserie.sort(function (a, b) {
        return a.dt - b.dt;
    });

    let addToInterval = (intervals, intervalIndex, value) => {
        if (!intervals[intervalIndex]) {
            intervals[intervalIndex] = Number.MAX_VALUE;
        } else if (intervals[intervalIndex] > value) {
            intervals[intervalIndex] = value;
        }
    }
    
    for (const element of sorted) {
        let intervalIndex = getIntervalTime(element.dt, intervalType, false).getTime();
        addToInterval(result, intervalIndex, utils.parseFloat(element.value, 5));
    }
    return result;
}

function getMax(timeserie, fromts, tots, intervalType) {
    let result = getInterval(fromts, tots, intervalType, Number.MIN_VALUE);
    // sort to start with the oldest
    let sorted = timeserie.sort(function (a, b) {
        return a.dt - b.dt;
    });

    let addToInterval = (intervals, intervalIndex, value) => {
        if (!intervals[intervalIndex]) {
            intervals[intervalIndex] = Number.MIN_VALUE;
        } else if (intervals[intervalIndex] < value) {
            intervals[intervalIndex] = value;
        }
    }
    
    for (const element of sorted) {
        let intervalIndex = getIntervalTime(element.dt, intervalType, false).getTime();
        addToInterval(result, intervalIndex, utils.parseFloat(element.value, 5));
    }
    return result;
}

function getAverage(timeserie, fromts, tots, intervalType) {
    let result = getInterval(fromts, tots, intervalType, 0);
    let counts = getInterval(fromts, tots, intervalType, 0);
    // sort to start with the oldest
    let sorted = timeserie.sort(function (a, b) {
        return a.dt - b.dt;
    });

    let addToInterval = (intervals, counters, intervalIndex, value) => {
        if (utils.isNullOrUndefined(intervals[intervalIndex])) {
            intervals[intervalIndex] = 0;
        } else {
            intervals[intervalIndex] += value;
            counters[intervalIndex]++;
        }
    }
    
    for (const element of sorted) {
        let intervalIndex = getIntervalTime(element.dt, intervalType, false).getTime();
        addToInterval(result, counts, intervalIndex, Number.parseFloat(element.value));
    }
    // average
    for (const k of Object.keys(result)) {
        if (counts[k]) {
            result[k] = utils.parseFloat(result[k] / counts[k], 5);
        }
    }
    return result; 
}

function getSum(timeserie, fromts, tots, intervalType) {
    let result = getInterval(fromts, tots, intervalType, 0);
    // sort to start with the oldest
    let sorted = timeserie.sort(function (a, b) {
        return a.dt - b.dt;
    });

    let addToInterval = (intervals, intervalIndex, value) => {
        if (utils.isNullOrUndefined(intervals[intervalIndex])) {
            intervals[intervalIndex] = 0;
        } else {
            intervals[intervalIndex] += value;
            intervals[intervalIndex] = utils.parseFloat(intervals[intervalIndex], 5)
        }
    }
    
    for (const element of sorted) {
        let intervalIndex = getIntervalTime(element.dt, intervalType, false).getTime();
        addToInterval(result, intervalIndex, Number.parseFloat(element.value));
    }
    return result;    
}


function getIntegral(timeserie, fromts, tots, intervalType) {
    let result = getInterval(fromts, tots, intervalType, Number.MAX_VALUE);
    // sort to start with the oldest
    let sorted = timeserie.sort(function (a, b) {
        return a.dt - b.dt;
    });

    let addToInterval = (intervals, intervalIndex, value) => {
        if (!intervals[intervalIndex]) {
            intervals[intervalIndex] = value;
        } else if (intervals[intervalIndex] > value) {
            intervals[intervalIndex] += value;
        }
    }
    
    let lastRecord = null;// : TimeValue { dt: number, value: number };
    let lastIntervalIndex = null;
    for (const element of sorted) {
        let intervalIndex = getIntervalTime(element.dt, intervalType, false).getTime();
        // check missing value to fill intervalsIndex
        while (lastIntervalIndex && lastIntervalIndex < intervalIndex) {
            let nextIntervalIndex = getIntervalTime(lastRecord.dt, intervalType, true).getTime();
            let delta = nextIntervalIndex - lastRecord.dt;
            addToInterval(result, nextIntervalIndex, Number.parseFloat(lastRecord.value) * (delta / 1000));
            lastIntervalIndex = nextIntervalIndex;
            lastRecord.dt = nextIntervalIndex;
        }
        // sum left => skip the first one
        if (lastRecord) {
            let delta = element.dt - lastRecord.dt;
            addToInterval(result, intervalIndex, Number.parseFloat(element.value) * (delta / 1000));
        }

        lastRecord = element;
        lastIntervalIndex = intervalIndex;
    }
    return result;
}

function getInterval(fromts, tots, type, defvalue) {
    let result = {};
    let dt = getStepDate(fromts, type, 0);
    while (dt.getTime() < tots) {
        result[dt.getTime()] = defvalue;
        dt = getStepDate(dt, type, 1);
    }
    return result;
}

function getIntervalTime(millyDt, _interval, next) {
    let dt = new Date(millyDt);
    let toadd = (next) ? 1 : 0;
    return getStepDate(dt, _interval, toadd);
}

function getStepDate(ts, type, toadd) {
    let dt = new Date(ts);
    if (type === ReportIntervalType.day) {
        dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + toadd, 0, 0, 0);
    } else { //if (type === ReportIntervalType.hour) {
        dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours() + toadd, 0, 0);
    }
    return dt;
}

module.exports = {
    getFunctionValues: getFunctionValues,
    getMin: getMin,
    getMax: getMax,
    getAverage: getAverage,
    getSum: this.getSum,
};

const ReportIntervalType = {
    hour: 'hour',
    day: 'day',
}

const ReportFunctionType = {
    min: 'min',
    max: 'max',
    average: 'average',
    sum: 'sum',
}
