/*
* Report: get data, create/send/store pdf
*/
const utils = require('../utils');
const Pdfmake = require('pdfmake');
var fs = require('node:fs')
var path = require('node:path');
// TODO wait compatibility with arm
// const imageGenerator = require('./helper/image-generator');
const { time } = require('node:console');

'use strict';

function Report(_property, _runtime) {
    var property = _property;
    var runtime = _runtime;
    var logger = runtime.logger;
    var currentTime = 0;
    var lastExecuted;

    this.execute = function (time, force) {
        currentTime = time;
        return new Promise(async function (resolve, reject) {
            try {
                if (!_isToExecute(time) && !force) {
                    resolve(true);
                } else {
                    await _createPdfBinary().then(filepath => {
                        if (property.receiver) {
                            let subject = `Report ${property.name}`;
                            let attachments = { path: filepath };
                            runtime.notificatorMgr.sendMailMessage(null, property.receiver, subject, '', null, attachments).then(function () {
                                logger.info(`report.sended.successful: ${new Date()} ${property.receiver} ${property.name}`);
                            }).catch(function (error) {
                                logger.error(`report.send.failed: ${error}`);
                            });
                        }
                        lastExecuted = currentTime;
                        resolve(filepath);
                    }).catch(function (error) {
                        reject(error);
                    });
                }
            } catch (error) {
                reject(error);
            }  
        });
    }

    this.getProperty = function () {
        return property;
    }

    this.getChartImage = function (itemChart, values) {
        return _getChartImage(itemChart, values);
    }

    var _getSampleValues = function (lines, timeRange) {
        let result = {};
        for (const line of lines) {
            result[line.id] = [{x: timeRange.begin, y: Math.floor(Math.random() * 100)},
                {x: timeRange.end, y: Math.floor(Math.random() * 100)}];
        }
        return result;
    }

    var _isToExecute = function (date) {
        if (inTimeToExecute(date.getHours()) && utils.dayOfYear(lastExecuted) !== utils.dayOfYear(date)) {
            if (property.scheduling === ReportSchedulingType.day) {
                return true;
            } else if (property.scheduling === ReportSchedulingType.week && date.getDay() === 1) {      // monday
                return true;
            } else if (property.scheduling === ReportSchedulingType.month && date.getDate() === 1) {
                return true;
            }
        }
        return false;
    }

    var _createPdfBinary = function () {
        return new Promise(async function (resolve, reject) {
            var fonts = {
                Roboto: {
                    normal: path.join(__dirname, 'fonts/Roboto-Regular.ttf'),
                    bold: path.join(__dirname, 'fonts/Roboto-Medium.ttf'),
                    italics: path.join(__dirname, 'fonts/Roboto-Italic.ttf'),
                    bolditalics: path.join(__dirname, 'fonts/Roboto-MediumItalic.ttf')
                }
              };
            let pdfmake = new Pdfmake(fonts);
            await _getPdfContent(property).then(content => {
                let docPath = path.join(runtime.settings.reportsDir,`${property.name}_${utils.getDate(new Date())}.pdf`);
                pdfDoc = pdfmake.createPdfKitDocument(content, {});
                const stream = fs.createWriteStream(docPath);
                pdfDoc.pipe(stream);
                pdfDoc.end();
                stream.on("finish", function() {
                    resolve(docPath);
                });
            }).catch(function (error) {
                reject(error);
            });
        });
    }

    var _getPdfContent = function (report) {
        return new Promise(async function (resolve, reject) {
            try {
                let docDefinition = {...report.docproperty };
                docDefinition['header'] = { text: 'FUXA by frangoteam', style:[{fontSize: 6}]};
                docDefinition['footer'] = function(currentPage, pageCount) { 
                    return { text: currentPage.toString() + ' / ' + pageCount, style:[{alignment: 'right', fontSize: 8}]} ; 
                },                
                docDefinition['content'] = [];
                for (let i = 0; i < report.content.items.length; i++) {
                    let item = report.content.items[i];
                    switch (item.type) {
                    case 'text': {
                        docDefinition['content'].push({ text: item.text, style: [{ alignment: item.align, fontSize: item.size }] });

                    break;
                    }
                    case 'table': {
                        await _getTableContent(item).then(itemTable => {
                            const tableDateRange = _getDateRange(item.range);
                            docDefinition['content'].push({ text: `${tableDateRange.begin.toLocaleDateString()} - ${tableDateRange.end.toLocaleDateString()}`,
                                style: [{ fontSize: item.size }] }, itemTable);
                        });

                    break;
                    }
                    case 'alarms': {
                        await _getAlarmsContent(item).then(itemAlarms => {
                            const alarmsDateRange = _getDateRange(item.range);
                            docDefinition['content'].push({ text: `${alarmsDateRange.begin.toLocaleDateString()} - ${alarmsDateRange.end.toLocaleDateString()}`,
                                style: [{ fontSize: item.size }] }, itemAlarms);
                        });

                    break;
                    }
                    case 'chart': {
                        await _getChartContent(item).then(itemChart => {
                            docDefinition['content'].push(itemChart);
                        });

                    break;
                    }
                    // No default
                    }
                }
                resolve(docDefinition);
            } catch (error) {
                reject(error);
            }
        });
    }

    var _getTableContent = function (item) {
        return new Promise(async function (resolve, reject) {
            try {
                let content = { layout: 'lightHorizontalLines', fontSize: item.size }; // optional
                let header = item.columns.map(col => { 
                    return { text: col.tag.label || col.tag.name, bold: true, style: [{ alignment: col.align }] }
                });
                //item.columns.map(col => col.tag.address || '');
                let values = [];
                let tagsids = item.columns.filter(col => col.type !== 0).map(col => col.tag.id);
                let fncs = item.columns.filter(col => col.type !== 0).map(col => col.function);
                let timeRange = _getDateRange(item.range);
                let options = { interval: item.interval, functions: fncs };
                await runtime.daqStorage.getNodesValues(tagsids, timeRange.begin.getTime(), timeRange.end.getTime(), options).then(result => {
                    values = !result || result.length === 0 ? [item.columns.map(col => { return {text: ''}})] : result;
                }).catch(function (error) {
                    values = [item.columns.map(col => { return {text: 'ERROR'}})];
                });
                content['table'] = {
                    // headers are automatically repeated if the table spans over multiple pages
                    // you can declare how many rows should be treated as headers
                    headerRows: 1,
                    widths: item.columns.map(col => col.width), //[ '*', 'auto', 100],
                    body: [
                        header,
                        ...values
                    ]
                }
                resolve(content);
            } catch (error) {
                reject(error);
            }                
        });
    }

    var _getChartContent = function (itemChart) {
        return new Promise(async function (resolve, reject) {
            try {
                let values = {};
                let tagsids = itemChart.chart.lines.map(line => line.id);
                let timeRange = _getDateRange(itemChart.range);
                await runtime.daqStorage.getNodesValues(tagsids, timeRange.begin.getTime(), timeRange.end.getTime(), null).then(result => {
                    values = result ? result : {};
                }).catch(function (error) {
                    values = {};
                });
                await _getChartImage(itemChart, values).then((imageData) => {
                    content = {
                        layout: 'lightHorizontalLines',
                        image: `data:image/png;base64,${imageData.toString('base64')}`,
                        // if you specify both width and height - image will be stretched
                        width: itemChart.width || 500,
                        height: itemChart.height || 350,
                        // height: 70
                    }
                    resolve(content);
                }).catch(function (error) {
                    reject(error);
                });
            } catch (error) {
                reject(error);
            }                
        });
    }

    var _getChartImage = function (itemChart, values) {
        return new Promise(async function (resolve, reject) {
            const timeRange = _getDateRange(itemChart.range);
            if (!values) {
                values = _getSampleValues(itemChart.chart.lines, timeRange);
            }
            reject('TODO node create image from canvas is not supported!');

            // TODO wait compatibility with arm
            // imageGenerator.createImage(itemChart, values).then((content) => {
            //     resolve(content.toString('base64'));
            // }).catch(function (err) {
            //     reject(err);
            //     logger.error("createImage: " + err);
            // });
        });
    }

    var _getDateRange = function (dateRange) {
        switch (dateRange) {
        case ReportDateRangeType.day: {
            var yesterday = new Date(currentTime || Date.now());
            yesterday.setDate(yesterday.getDate() - 1);
            return { 
                begin: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()), 
                end: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59)
            };
        }
        case ReportDateRangeType.week: {
            var lastWeek = new Date(currentTime || Date.now());
            lastWeek = new Date(lastWeek.setDate(lastWeek.getDate() - 7 - (lastWeek.getDay() + 6 ) % 7));
            var diff = lastWeek.getDate() - lastWeek.getDay() + (lastWeek.getDay() == 0 ? -6 : 1); // adjust when day is sunday
            lastWeek = new Date(lastWeek.setDate(diff));
            return { 
                begin: new Date(lastWeek.getFullYear(), lastWeek.getMonth(), lastWeek.getDate()), 
                end: new Date(lastWeek.getFullYear(), lastWeek.getMonth(), lastWeek.getDate() + 6, 23, 59, 59)
            };
        }
        case ReportDateRangeType.month: {
            var lastMonth = new Date(currentTime || Date.now());
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            lastMonth.setDate(-1);
            return { 
                begin: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1), 
                end: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), lastMonth.getDate(), 23, 59, 59)
            };
        }
        default: {
            return { 
                begin: new Date(currentTime || Date.now()), 
                end: new Date(currentTime || Date.now())
            };
        }
        }
    }

    var _getAlarmsContent = function (item) {
        return new Promise(async function (resolve, reject) {
            try {
                let content = { layout: 'lightHorizontalLines', fontSize: item.size }; // optional
                let header = Object.values(item.propertyText).map(col => { 
                    return { text: col, bold: true, style: [{ alignment: 'left' }] }
                });
                let values = [];
                const timeRange = _getDateRange(item.range);
                const query = { from: timeRange.begin.getTime(), to: timeRange.end.getTime() };
                await runtime.alarmsMgr.getAlarmsHistory(query).then(result => {
                    if (!result || result.length === 0) {
                        values = [Object.values(item.propertyText).map(col => { 
                            return { text: '', style: [{ alignment: 'left' }] }
                        })];
                     } else {
                        const property = Object.keys(item.property).filter(prop => { if (item.property[prop]) return prop; });
                        values = result.filter(alr => { if (item.priority[alr.type]) return alr; });
                        values = values.map(alr => {
                            let row = [];
                            for (const prop of property) {
                                var text = '';
                                if (prop === 'ontime' && alr.ontime) text = utils.getFormatDate(new Date(Number(alr.ontime)), 'ymd');
                                else if (prop === 'offtime' && alr.offtime) text = utils.getFormatDate(new Date(Number(alr.offtime)), 'ymd');
                                else if (prop === 'acktime' && alr.acktime) text = utils.getFormatDate(new Date(Number(alr.acktime)), 'ymd');
                                else switch (prop) {
 case 'text': {
 text = alr.text;
 break;
 }
 case 'group': {
 text = alr.group;
 break;
 }
 case 'userack': {
 text = alr.userack;
 break;
 }
 case 'status': {
 text = item.statusText[alr.status];
 break;
 }
 case 'type': { {
 text = item.priorityText[alr.type];
 // No default
 }
 break;
 }
 }
                                row.push({text: text, style: [{fillColor: alr.bkcolor, color: alr.color}]});
                            }
                            return row;
                        })
                     }
                }).catch(function (error) {
                    values = [Object.values(item.propertyText).map(col => { return {text: 'ERROR'}})];
                });
                content['table'] = {
                    // headers are automatically repeated if the table spans over multiple pages
                    // you can declare how many rows should be treated as headers
                    headerRows: 1,
                    widths: Object.values(item.propertyText).map(col => '*'), //[ '*', 'auto', 100],
                    body: [
                        header,
                        ...values
                    ]
                }
                resolve(content);
            } catch (error) {
                reject(error);
            }
        });
    }
}

function inTimeToExecute(hour) {
    return (hour >= 2 && hour <= 3);
}

const ReportSchedulingType = {
    none: 'none',
    day: 'day',
    week: 'week',
    month: 'month',
}

const ReportDateRangeType = {
    none: 'none',
    day: 'day',
    week: 'week',
    month: 'month',
}

module.exports = {
    create: function (property, runtime) {
        return new Report(property, runtime);
    },
    ReportSchedulingType: ReportSchedulingType
}