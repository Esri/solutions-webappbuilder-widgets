///////////////////////////////////////////////////////////////////////////
// Copyright © 2017 Esri. All Rights Reserved.
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
  'dijit/_WidgetBase',
  "dijit/_TemplatedMixin",
  "dijit/form/Button",
  'dojo/_base/lang',
  "dojo/_base/array",
  'dojo/_base/html',
  'dojo/dom-class',
  'dojo/on',
  'dojo/Evented',
  "dojo/has",
  "dojo/dom-construct",
  "dojo/store/Memory",
  "dojo/query",
  "dojo/store/Observable",
  "dgrid/OnDemandList",
  "dgrid/Selection",
  "dgrid/OnDemandGrid",
  "esri/geometry/Extent",
  "esri/tasks/query",
  "esri/geometry/geometryEngine",
],
function (declare, _WidgetBase, _TemplatedMixin, Button, lang, array, html, domClass, on, Evented, has, domConstruct, Memory, query, Observable, List, Selection, Grid, Extent, Query, geometryEngine) {
  return declare([_WidgetBase, _TemplatedMixin, Evented], {
    'baseClass': 'critical-facilities-unmatched-list',
    declaredClass: 'criticalFacilities.UnMatchedList',
    templateString: "<div><div class='dGridContainer'><div data-dojo-attach-point='listDiv' class='list'></div>" +
                    "</div><div class='btnContainer'><div class='btnParent'><button class='my-btn' data-dojo-attach-event='onClick:_exportCSV'>" +
                    "Export to CSV</button></div></div></div>",

    //TODO needs work to truely handle nls
    postMixInProperties: function () {
      this.nls = window.jimuNls.common;
    },

    postCreate: function () {
      this.store = new Observable(new Memory());
    },

    //options = {featureSet: <Object>, map: <Object>, fields: [], configFields: []}
    createList: function (options) {
      lang.mixin(options.nls, this.nls);

      var featureSet = options.featureSet;
      for (var j = 0; j < featureSet.features.length; j++) {
        var feature = featureSet.features[j];
        this.store.put(feature, {
          id: parseInt(feature.attributes["ObjectID"]) //TODO make sure this is good
        });
      };

      this.list = new (declare([List]))({
        map: options.map,
        store: this.store,
        fields: options.fields,
        configFields: options.configFields,
        rowState: {},
        cleanEmptyObservers: false,
        renderRow: function (feature) {
          var isOpen = false;
          if (typeof (this.rowState) !== 'undefined') {
            if (typeof (this.rowState[feature.id]) !== 'undefined') {
              isOpen = this.rowState[feature.id];
            }
          }

          var divNode = domConstruct.create('div', {
            className: "bottom-border jimu-main-background"
          });

          var titleDiv = domConstruct.create('div', {
            className: "titleDiv",
            onclick: function (evt) {
              var parent = evt.target.parentNode;
              if (!domClass.contains(parent, "bottom-border")) {
                for (var i = 0; i < 2; i++) {
                  parent = parent.parentNode;
                  if (domClass.contains(parent, "bottom-border")) {
                    break;
                  }
                }
              }
              var img = parent.childNodes[0].childNodes[0];
              var row = parent.childNodes[1];
              if (domClass.contains(row, "rowOff")) {
                domClass.remove(row, "rowOff");
                domClass.add(row, "rowOn");
                domClass.remove(img, "downImage");
                domClass.add(img, "upImage");
                domClass.remove(img, "image-down-highlight");
                domClass.add(img, "image-up-highlight");
              } else {
                domClass.remove(row, "rowOn");
                domClass.add(row, "rowOff");
                domClass.remove(img, "upImage");
                domClass.add(img, "downImage");
                domClass.remove(img, "image-up-highlight");
                domClass.add(img, "image-down-highlight");
              }
            }
          }, divNode);

          domConstruct.create('div', {
            className: "baseImage downImage image-down-highlight"
          }, titleDiv);

          var title = domConstruct.create('div', {
            className: "title"
          }, titleDiv);

          var contentDiv = domConstruct.create('div', {
            className: isOpen ? "rowOn" : "rowOff",
            id: feature.id
          }, divNode);

          if (isOpen) {
            var img = contentDiv.parentElement.childNodes[0].childNodes[0];
            domClass.remove(img, "downImage");
            domClass.add(img, "upImage");
            domClass.remove(img, "image-down-highlight");
            domClass.add(img, "image-up-highlight");
          }

          var idx = 0;
          for (var i = 0; i < this.fields.length; i++) {
            var fieldName = this.fields[i].name;
            var v = "";
            var id = fieldName + "-_-" + feature.id;
            if (this.localUpdates && this.localUpdates.hasOwnProperty(id)) {
              v = this.localUpdates[id];
            } else {
              v = feature.attributes[fieldName];
            }
            //do this so we can have the OID in the query to support selection
            // but avoid drawing in the widget
            //if (typeof (this.configFields[fieldName]) !== 'undefined') {
              domConstruct.create('label', {
                className: "fieldItemLabel",
                innerHTML: fieldName + ":" //this.configFields[fieldName] + ":"
              }, contentDiv);
              domConstruct.create('input', {
                className: "fieldItemValue",
                value: v,
                oninput: lang.hitch(this, function (e) {
                  var v = e.srcElement.value;
                  var lbl = e.srcElement.previousElementSibling;
                  var name = lbl.textContent.substring(0, lbl.textContent.length - 1);

                  var fieldName;
                  for (var i in this.configFields) {
                    if (this.configFields[i] === name) {
                      fieldName = i;
                      break;
                    }
                  }

                  if (typeof (this.localUpdates) === 'undefined') {
                    this.localUpdates = {};
                  }

                  this.localUpdates[fieldName + "-_-" + feature.id] = v;
                })
              }, contentDiv);

              if (idx === 0) {
                title.innerHTML = feature.attributes[fieldName];
                idx += 1;
              }
            }
          //}

          var alignContainer = domConstruct.create('div', {
            className: "fieldItemLabel"
          }, contentDiv);

          var btnContainer = domConstruct.create('div', {
            className: "btnParent"
          }, alignContainer);

          domConstruct.create('div', {
            className: "locate-btn",
            title: "this.nls.locateFeature",
            onclick: lang.hitch(this, function (evt) {
              var row = evt.target.parentElement.parentElement.parentElement;
              var rowData = this.row(row.id).data;
              if (rowData) {
                var geom = rowData.geometry;
                if (geom.type === "point") {
                  var res = geometryEngine.buffer([geom], 1, 9035, false);
                  geom = res[0];
                }
                this.map.setExtent(geom.getExtent());
              }
            })
          }, btnContainer);

          //domConstruct.create('button', {
          //  className: "my-btn",
          //  innerHTML: "Update Feature Collection",
          //  onclick: lang.hitch(this, function (evt) {
          //    var row = evt.target.parentElement.parentElement.parentElement;
          //    var rowData = this.row(row.id).data;
          //    if (rowData) {
          //      var geom = rowData.geometry;
          //      if (geom.type === "point") {
          //        var res = geometryEngine.buffer([geom], 1, 9035, false);
          //        geom = res[0];
          //      }
          //      this.map.setExtent(geom.getExtent());
          //    }
          //  })
          //}, btnContainer);

          return divNode;
        }
      }, this.listDiv);

      this.list.startup();

      return this.list;
    },

    _exportCSV: function () {
      //Call jimu CSVUtils here to export 
    }
  });
});