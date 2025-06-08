const os = require('node:os');
const ip = require('ip');

'use strict';
var utils = module.exports = {

    domStringSplitter: function (src, tagsplitter, first) {
        var result = { before: '', tagcontent: '', after: '' };
        var tagStart = '<' + tagsplitter.toLowerCase();
        var tagEnd = '</' + tagsplitter.toLowerCase(); 
        var text = src.toLowerCase();
        var start = text.indexOf(tagStart, first);
        var end = text.indexOf(tagEnd, start);
        result.before = src.slice(0, start);
        result.tagcontent = src.slice(start, end);
        result.after = src.slice(end);
        return result;
    },

    domStringSetAttribute: function (src, tags, attribute) {
        var result = src;
        for (const tag of tags) {
            var text = result.toLowerCase();
            var tagStart = '<' + tag.toLowerCase();
            var pos = 0;
            var temp  = '';
            while((pos = text.indexOf(tagStart, pos)) !== -1) {
                pos += tagStart.length + 1;
                temp += src.slice(0, pos) + attribute + ' ' + src.slice(pos);
            }
            if (temp.length > 0) {
                result = temp;
            }
        }
        return result;
    },

    /**
    * Return available interface to use
    */
    getHostInterfaces: function() {
        return new Promise(function (resolve, reject) {
            try {
                let nics = [];
                const osNics = os.networkInterfaces();
                nics.push({ name: 'Default' });
                for (const ifname of Object.keys(osNics)) {
                    for (const iface of osNics[ifname]) {
                        if (iface.interal === true) continue;
                        if (iface.family !== 'IPv4') continue;
                        nics.push({
                            name: ifname,
                            address: iface.address,
                            broadcast: ip.subnet(iface.address, iface.netmask).broadcastAddress
                        });
                    }
                }
                resolve(nics);
            } catch (error) {
                reject('gethostinterfaces-error: ' + error);
            }
        });
    },

    endTime: function (startTime) {
        var endTime = new Date();
        return endTime - startTime;
    },

    isEmptyObject: function (value) {
        return value != null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0 && value.constructor === Object;
    },

    isObject(value) {
        var type = typeof value;
        return !!value && (type == 'object' || type == 'function');
    },

    isBoolean(value) {
        return (typeof value === 'boolean');
    },

    isPlainObject(value) {
        var Ctor;
        if (!(isObjectLike(value) && objToString.call(value) == objectTag && !isHostObject(value) && !isArguments(value)) ||
            (!hasOwnProperty.call(value, 'constructor') && (Ctor = value.constructor, typeof Ctor == 'function' && !(Ctor instanceof Ctor)))) {
          return false;
        }
        var result;
        if (lodash.support.ownLast) {
          baseForIn(value, function(subValue, key, object) {
            result = hasOwnProperty.call(object, key);
            return false;
          });
          return result !== false;
        }
        baseForIn(value, function(subValue, key) {
          result = key;
        });
        return result === undefined || hasOwnProperty.call(value, result);
    },

    isNullOrUndefined: function (ele) {
        return (ele === null || ele === undefined) ? true : false;
    },

    dayOfYear: function (date) {
        if (date) {
            return Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        }
        return -1;
    },

    getDate: function (dt) {
        var yyyy = dt.getFullYear();
        var mm = dt.getMonth() + 1;
        var dd = dt.getDate();
        if (dd < 10) {
            dd = '0' + dd;
        }
        if (mm < 10) {
            mm = '0' + mm;
        }
        var HH = dt.getHours();
        var MM = dt.getMinutes();
        var SS = dt.getSeconds();
        if (HH < 10) {
            HH = '0' + HH;
        }
        if (MM < 10) {
            MM = '0' + MM;
        }
        if (SS < 10) {
            SS = '0' + SS;
        }
        return `${yyyy}-${mm}-${dd}_${HH}-${MM}-${SS}`;
    },

    getFormatDate: function (dt, format) {
        var yyyy = dt.getFullYear();
        var mm = dt.getMonth() + 1;
        var dd = dt.getDate();
        if (dd < 10) {
            dd = '0' + dd;
        }
        if (mm < 10) {
            mm = '0' + mm;
        }
        var HH = dt.getHours();
        var MM = dt.getMinutes();
        var SS = dt.getSeconds();
        if (HH < 10) {
            HH = '0' + HH;
        }
        if (MM < 10) {
            MM = '0' + MM;
        }
        if (SS < 10) {
            SS = '0' + SS;
        }
        if (format === 'ymd') {
            return `${yyyy}/${mm}/${dd}/ ${HH}:${MM}:${SS}`;
        }
        return `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
    },

    isNumber: function(n) {
        if (!isNaN(n) && typeof n === 'number') {
            return true;
        }
        return false;
    },

    isFloat: function (n) {
        return Number(n) === n && n % 1 !== 0;
    },

    parseFloat: function (value, decimals) {
        return this.isFloat(value) ? Number.parseFloat(value.toFixed(decimals)) : Number.parseFloat(value);
    },

    isValidRange: function (min, max) {
        if (this.isNumber(min) && this.isNumber(max)) {
            return true;
        }
        return false;
    }
}