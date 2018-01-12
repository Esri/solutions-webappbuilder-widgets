///////////////////////////////////////////////////////////////////////////
// Copyright © 2016 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/Deferred',
  'dojo/DeferredList',
  'dojo/_base/array',
  'esri/request',
  'esri/geometry/webMercatorUtils',
  'esri/geometry/Polygon',
  'esri/geometry/Point',
  'esri/geometry/Multipoint',
  'esri/geometry/Polyline',
  'jimu/utils',
  'jimu/portalUtils',
  'jimu/portalUrlUtils',
  'jimu/tokenUtils',
  'jimu/dijit/Message',
  'jimu/dijit/SnapShot',
  './CSVUtils'
], function (
  declare,
  lang,
  Deferred,
  DeferredList,
  array,
  esriRequest,
  webMercatorUtils,
  Polygon,
  Point,
  Multipoint,
  Polyline,
  utils,
  portalUtils,
  portalUrlUtils,
  tokenUtils,
  Message,
  SnapShot,
  CSVUtils
) {

  //Create a 'Snap Shot' of the incident.
  // A feature collection is created for each configured tab layer.
  // The new layers are written to a newly created folder that is time stamped.
  // A web map is created that references each of the layers as well.
  var SnapShotUtils = declare('SnapShotUtils', null, {
    portal: null,
    portalUrl: "",
    logo: "",
    originMapId: "",
    originAppId: "",
    credential: null,
    nls: null,
    layerArray: [],
    parent: null,
    downloadAll: false,
    time: null,

    constructor: function (parent) {
      this.parent = parent;
      this.snapshot = new SnapShot(parent.appConfig, parent.map);
      this.map = this.parent.map;
      this.extent = this.map.extent;
      this.nls = lang.mixin({}, parent.nls, window.jimuNls.drawBox, window.jimuNls.snapshot);
    },

    createSnapShot: function (data) {
      var def = new Deferred();

      var baseName = utils.stripHTML(data.name);

      var time = this._getTime(data.time);
      this.createLayerItems(data, time, baseName).then(lang.hitch(this, function (items) {
        this.snapshot.createSnapShot({
          folderOptions: {
            folderName: baseName + '_' + time,
            title: baseName + '_' + time,
            description: baseName + " " + this.nls.snapshot
          },
          mapTitle: baseName + " (" + this.nls.snapshot_append + " " + time + ")",
          name: baseName + " (" + time + ")",
          shareWith: {
            everyone: false,
            org: false,
            groups: data.groups.join()
          },
          mapExtent: this.map.extent,
          data: items
        }).then(function () {
          def.resolve();
        });
      }));
      return def;
    },

    _getTime: function (time) {
      var date = new Date(time);
      var _off = date.getTimezoneOffset();
      return utils.fieldFormatter.getFormattedDate(date, {
        dateFormat: 'shortDateShortTime'
      }) + " " + this.nls.utc + (_off < 0 ? "+" + (Math.abs(_off) / 60) : "-" + (_off / 60));
    },

    /* jshint unused: true */
    createLayerItems: function (data, time, baseName) {
      var def = new Deferred();

      var layers = data.layers.reverse();
      this.buffers = data.buffers;
      this.incidents = data.incidents;

      var defArray = [];
      for (var i = 0; i < layers.length; i++) {
        var push = true;
        if (layers[i].analysisObject && typeof (layers[i].analysisObject.featureCount) !== 'undefined' &&
          layers[i].analysisObject.featureCount === 0) {
          push = false;
        }
        if (layers[i].graphics && layers[i].graphics.length === 0) {
          push = false;
        }
        if (push) {
          defArray.push(this.createItem(layers[i], this.incidents, this.buffers, time, this.nls, baseName));
        }
      }

      var itemList = [];
      var defList = new DeferredList(defArray);
      defList.then(lang.hitch(this, function (defResults) {
        for (var r = 0; r < defResults.length; r++) {
          var featureSet = defResults[r][1];
          if (Array.isArray(featureSet)) {
            for (var ii = 0; ii < featureSet.length; ii++) {
              itemList.push(featureSet[ii]);
            }
          } else {
            itemList.push(featureSet);
          }
        }
        def.resolve(itemList);
      }), lang.hitch(this, function (err) {
        def.reject(err);
      }));
      return def;
    },

    createItem: function (lo, incidents, buffers, time, nls, baseName) {
      var def = new Deferred();

      var layerDetails = {
        label: lo.label,
        title: lo.label + '_' + time,
        desc: nls.snapshot_append + " " + nls.of_append + " " + (lo.type ? lo.type : lo.label) +
        " " + nls.layer_append + " " + lo.label + " (" + time + ")",
        name: lo.label + " (" + time + ")",
        tags: [baseName + "," + nls.snapshot_append]
      };

      //test if analysis layer or an incident/buffer layer
      if (lo.layerObject) {
        var layer = lo.layerObject;
        var ao = lo.analysisObject;
        var pi;
        if (layer.infoTemplate && layer.infoTemplate.info) {
          pi = layer.infoTemplate.info;
        }
        layerDetails.popupInfo = pi;
        //TODO should consolidate these split due to grouped needing a num arg also
        //also spilt due to differences in the return object that should be consolidated also
        // for example Grouped returns both an array of graphics and the grouped analysis results
        //should standardize the name for both and return objects for both as well as ensure the args match
        if (lo.type === 'groupedSummary' || lo.type === 'summary') {
          ao.updateForIncident(incidents, buffers, null, null, true, true, true).then(
            lang.hitch(this, function (results) {
            var t = this.createAnalysisLayerJSON(results, layer, nls, time, layerDetails);
            def.resolve(t);
          }));
        } else {
          var dist = lo.type === 'closest' ? this.parent.config.maxDistance : buffers;
          ao.updateForIncident(incidents, dist, null, true, true, true).then(lang.hitch(this, function (results) {
            var t = this.createAnalysisLayerJSON(results, layer, nls, time, layerDetails);
            def.resolve(t);
          }));
        }
      } else {
        var t = this.createIncidentBufferLayerJSON(lo.graphics, nls, time, layerDetails);
        def.resolve(t);
      }
      return def;
    },

    createAnalysisLayerJSON: function (results, layer, nls, time, layerDetails) {
      var graphics = results.graphics;
      var _fields = results.context._exportToCSV(graphics, true);
      var fields = [];
      for (var j = 0; j < _fields.length; j++) {
        var fld = _fields[j];
        if (fld.type !== 'esriFieldTypeOID') {
          fields.push(fld);
        }
      }

      for (var i = 0; i < graphics.length; i++) {
        var f = graphics[i];
        if (f.geometry.cache) {
          f.geometry.clearCache();
          delete (f.geometry.cahce);
        }
      }
      return {
        graphics: graphics,
        renderer: layer.renderer,
        infoTemplate: layerDetails.popupInfo,
        fields: fields,
        tags: layerDetails.tags,
        description: layerDetails.desc,
        name: layerDetails.name,
        visibleOnStartup: false,
        typeIdField: layer.typeIdField,
        types: layer.types,
        minScale: layer.minScale,
        maxScale: layer.maxScale
      };
    },

    /* jshint ignore:start */
    createIncidentBufferLayerJSON: function (graphics, nls, time, layerDetails) {
      var points = [];
      var lines = [];
      var polys = [];
      var layers_array = [];
      array.forEach(graphics, function (g) {
        switch (g.geometry.type) {
          case "point":
            points.push(g);
            break;
          case "polyline":
            lines.push(g);
            break;
          case "polygon":
            polys.push(g);
            break;
        }
      });
      var incidentLayers = [];
      if (points.length > 0) {
        incidentLayers.push(points);
      }
      if (lines.length > 0) {
        incidentLayers.push(lines);
      }
      if (polys.length > 0) {
        incidentLayers.push(polys);
      }
      var lyrs = [];
      var gl = {
        'point': "esriGeometryPoint",
        'polyline': "esriGeometryPolyline",
        'polygon': "esriGeometryPolygon"
      };
      var _gtName = {
        'point': this.nls.point,
        'polyline': this.nls.line,
        'polygon': this.nls.polygon
      };
      for (var j = 0; j < incidentLayers.length; j++) {
        var _graphics = incidentLayers[j];
        var _gt;
        if (_graphics.length > 0) {
          var g = _graphics[0];
          _gt = _gtName[typeof (g.geometry) !== 'undefined' ? g.geometry.type : g.type];
          var gt = gl[typeof (g.geometry) !== 'undefined' ? g.geometry.type : g.type];

          layers_array.push({
            graphics: _graphics,
            fields: [],
            tags: layerDetails.tags,
            description: layerDetails.desc,
            name: incidentLayers.length === 1 ? layerDetails.name : _gt + " " + layerDetails.name,
            visibleOnStartup: false
          });
        }
      }
      return layers_array;
    },
    /* jshint ignore:end */

    createDownloadZip: function (analysisObjects, incidents, buffers) {
      var def = new Deferred();
      //TODO these are temp so I can remember what they are for while working through this
      var createSnapShot = false;
      var downloadAll = this.downloadAll;
      var calcResults = this.nls.calculated_results;
      this._performAnalysis(analysisObjects, incidents, buffers, downloadAll, createSnapShot).then(function (results) {
        var calculatedResults = [];
        for (var i = 0; i < results.length; i++) {
          var result = results[i];
          var calcResult = result.context._exportToCSV(result.graphics, false, true, result.analysisResults);
          if (calcResult) {
            calculatedResults.push(calcResult);
          }
        }

        //This will add them all to one sheet...would still need to maintain a seperate
        // instance of CSVUtils to support this as it's not a standard thing to do with CSVs
        if (calculatedResults.length > 0) {
          CSVUtils.exportCalculatedResultsCSV(calcResults, calculatedResults);
        }

        //I see jsZip in the node_modules folder but I'm still looking for anything else in WAB that may use it
        // need to check with the WAB team to ensure I can expect this to remain there
        //var zip = new JSZip();
        //zip.file("Hello.txt", "Hello World\n");
        //var img = zip.folder("images");
        //img.file("smile.gif", imgData, { base64: true });
        //zip.generateAsync({ type: "blob" })
        //.then(function (content) {
        //  // see FileSaver.js
        //  saveAs(content, "example.zip");
        //});

        //var zip = new JsZip();

        //from Session.js in node_modules
        //main other place I see it used is in server/utils.js
        //var JsZip = require('jszip');
        //zip.file(path.basename(filename), content);
        //var data = zip.generate({ type: 'base64' });
        //zip = null;

        //resolve(self._post('file', { file: data }));

        def.resolve('success');
      }, function (err) {
        def.reject(err);
      });
      return def;
    },

    _performAnalysis: function (analysisObjects, incidents, buffers, downloadAll, createSnapShot) {
      //TODO if createSnapshot is false we are downloading the CSV and need to honor the all fields setting if it is true
      var def = new Deferred();
      var defArray = [];
      for (var i = 0; i < analysisObjects.length; i++) {
        var ao = analysisObjects[i];
        console.log("AO: " + ao);
        //will set snapShot to true so it will create the defferd object..will just handle the results differently
        var isSnapShot = true;

        var push = true;
        if (ao.analysisObject && typeof (ao.analysisObject.featureCount) !== 'undefined' &&
          ao.analysisObject.featureCount === 0) {
          push = false;
        }
        if (push) {
          if (ao.type === 'groupedSummary' || ao.type === 'summary') {
            //TODO these have an extra num arg...can I do the same for prox so we don't have to check this?
            defArray.push(ao.analysisObject.updateForIncident(incidents, buffers, null, null,
              isSnapShot, createSnapShot, downloadAll));
          } else {
            var dist = ao.type === 'closest' ? this.parent.config.maxDistance : buffers;
            defArray.push(ao.analysisObject.updateForIncident(incidents, dist, null,
              isSnapShot, createSnapShot, downloadAll));
          }
        }
      }
      var results = [];
      var defList = new DeferredList(defArray);
      defList.then(lang.hitch(this, function (defResults) {
        for (var r = 0; r < defResults.length; r++) {
          var resultSet = defResults[r][1];
          results.push(resultSet);
        }
        def.resolve(results);
      }), lang.hitch(this, function (err) {
        console.error(err);
        def.reject(err);
      }));
      return def;
    }
  });

  return SnapShotUtils;

});
