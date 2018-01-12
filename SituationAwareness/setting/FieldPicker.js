///////////////////////////////////////////////////////////////////////////
// Copyright © 2016 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define(['dojo/_base/declare',
  'dijit/_WidgetsInTemplateMixin',
  'dijit/form/Select',
  'dijit/form/ValidationTextBox',
  'dijit/registry',
  'dojo/dom-construct',
  'dojo/_base/array',
  'dojo/_base/lang',
  'dojo/_base/html',
  'dojo/dom-style',
  'dojo/dom-class',
  'dojo/Deferred',
  'dojo/on',
  'dojo/query',
  'jimu/BaseWidget',
  'jimu/dijit/Message',
  'jimu/utils',
  'esri/layers/FeatureLayer',
  'dojo/text!./FieldPicker.html',
  'dojo/Evented',
  'jimu/dijit/SimpleTable'],
function (declare,
  _WidgetsInTemplateMixin,
  Select,
  ValidationTextBox,
  registry,
  domConstruct,
  array,
  lang,
  html,
  domStyle,
  domClass,
  Deferred,
  on,
  query,
  BaseWidget,
  Message,
  utils,
  FeatureLayer,
  template,
  Evented,
  Table) {
  return declare([BaseWidget, _WidgetsInTemplateMixin, Evented], {
    templateString: template,
    baseClass: 'jimu-widget-SAT-setting',
    advStat: {},
    fieldsList: null,
    callerLayer: null,
    callerTab: null,
    callerOpLayers: null,
    layerList: null,
    test: false,
    fields: null,
    hasFields: true,

    constructor: function (/*Object*/args) {
      this.map = args.map;
      if (args.test) {
        this.test = args.test;
      }
    },

    postMixInProperties: function () {
      this.inherited(arguments);
      this.nls.common = window.jimuNls.common;
    },

    postCreate: function () {
      this.inherited(arguments);
      this.startup();
    },

    startup: function () {
      var fields = null;
      if (!this.test) {
        if (this.callerTab.type === "summary") {
          fields = [{
            name: "layer",
            title: this.nls.fieldTitle,
            "class": "label",
            type: "empty",
            width: "250px"
          }, {
            name: "label",
            title: this.nls.layerLabel,
            "class": "label",
            type: "empty",
            width: "200px"
          }, {
            name: "type",
            title: this.nls.typeTitle,
            "class": "sumlabel",
            type: "empty"
          }, {
            name: "actions",
            title: this.nls.actionsTitle,
            "class": "actions",
            type: "actions",
            actions: ["up", "down", "delete"]
          }];
        } else if (this.callerTab.type === "groupedSummary") {
          fields = [{
            name: "layer",
            title: this.nls.groupByField,
            "class": "label",
            type: "empty",
            width: "40%"
          }, {
            name: "label",
            title: this.nls.layerLabel,
            "class": "label",
            type: "empty",
            width: "20%"
          }, {
            name: "type",
            title: this.nls.labelType,
            "class": "label",
            type: "empty",
            width: "20%"
          }];
        } else {
          fields = [{
            name: "layer",
            title: this.nls.fieldTitle,
            "class": "label",
            type: "empty",
            width: "60%"
          }, {
            name: "actions",
            title: this.nls.actionsTitle,
            "class": "actions",
            type: "actions",
            actions: ["up", "down", "delete"],
            width: "40%"
          }];
        }

        var args = {
          fields: fields
        };
        this.displayFieldsTable = new Table(args);
        this.displayFieldsTable.placeAt(this.fieldTable);
        html.setStyle(this.displayFieldsTable.domNode, {
          'height': '100%'
        });
        this.displayFieldsTable.startup();

        this.operationsList = [];
        if (this.callerTab.type === "summary") {
          this.operationsList.push({
            value: 'sum',
            label: this.nls.sum
          }, {
            value: 'avg',
            label: this.nls.avg
          }, {
            value: 'min',
            label: this.nls.min
          }, {
            value: 'max',
            label: this.nls.max
          });
        } else if (this.callerTab.type === "groupedSummary") {
          this.operationsList.push({
            value: 'pre',
            label: this.nls.prefix
          }, {
            value: 'suf',
            label: this.nls.suffix
          });
        }

        // TO DO: change column label
        /*jshint unused: true*/
        if (this.callerTab.type === "summary") {
          domStyle.set(this.chk_summary, "display", "block");
          domStyle.set(this.chk_summaryLabels, "display", "block");
          domStyle.set(this.chk_countOnly, "display", "none");
        } else {
          domStyle.set(this.chk_countOnly, "display", "block");
          domStyle.set(this.chk_summary, "display", "none");
          domStyle.set(this.chk_summaryLabels, "display", "none");
        }

        this.btnCancel.innerText = this.nls.common.cancel;
        this.own(on(this.btnCancel, 'click', lang.hitch(this, function () {
          this.emit('cancel');
        })));

        this.btnOk.innerText = this.nls.common.ok;
        this.own(on(this.btnOk, 'click', lang.hitch(this, function () {
          if (!domClass.contains(this.btnOk, 'jimu-state-disabled')) {
            this.updateSummaryType();
            var ok = false;
            for (var key in this.advStat.stats) {
              if (this.advStat.stats.hasOwnProperty(key)) {
                ok = true;
              }
            }
            if (!ok) {
              this.advStat = null;
            }
            this.emit('ok', this.advStat);
          }
        })));

        this.layerTables = [];
        this.summaryLayers = [];
        this.advStat = {};
        this._getAllValidLayers().then(lang.hitch(this, function () {
          if (this.callerTab.type === "groupedSummary") {
            //hide add field
            domStyle.set(this.btnAddField, "display", "none");
            if (this.hasFields) {
              this._addTabRow();
            }
          } else {
            if (this.hasFields) {
              this.addHandler = this.own(on(this.btnAddField, 'click', lang.hitch(this, this._addTabRow)));
              this.own(on(this.displayFieldsTable, 'row-delete', lang.hitch(this, this._rowDeleted)));
            }
          }
        }));
      }
    },

    _updateGeomOptions: function (geomType) {
      if (!geomType) {
        return;
      }
      this.chk_area.set("disabled", (geomType !== "esriGeometryPolygon"));
      this.chk_length.set("disabled", (geomType !== "esriGeometryPolyline"));
    },

    _getAllValidLayers: function (test) {
      var def = new Deferred();
      array.forEach(this.callerOpLayers, lang.hitch(this, function (OpLyr) {
        if (OpLyr.newSubLayers.length > 0) {
          this._recurseOpLayers(OpLyr.newSubLayers);
        } else {
          if (OpLyr.id === this.callerLayer) {
            this.layerList = OpLyr;
          }
        }
      }));
      if (this.layerList.layerObject.empty) {
        if (this.layerList.layerObject.url) {
          var tempFL = new FeatureLayer(this.layerList.layerObject.url);
          on(tempFL, "load", lang.hitch(this, function () {
            this._completeMapLayers(tempFL, test);
            def.resolve('sucess');
          }));
        }
      } else {
        this._completeMapLayers(this.layerList, test);
        def.resolve('sucess');
      }
      return def;
    },

    _recurseOpLayers: function (pNode) {
      var nodeGrp = pNode;
      array.forEach(nodeGrp, lang.hitch(this, function (Node) {
        if (Node.newSubLayers.length > 0) {
          this._recurseOpLayers(Node.newSubLayers);
        } else {
          if (Node.id === this.callerLayer) {
            this.layerList = Node;
          }
        }
      }));
    },

    //After the class has returned layers, push only Featurelayers and Layers into the layer list.
    /*jshint loopfunc: true */
    _completeMapLayers: function (args, test) {
      if (args) {
        var layer = typeof (args.layerObject) === 'undefined' ? args : args.layerObject;
        //get geom type and object id field
        var geomType = layer.geometryType;
        this.objectIdField = layer.objectIdField;
        var aStat = {
          "url": layer.url,
          "stats": {}
        };
        var _fields = lang.clone(layer.fields);
        var skipFields = this.getSkipFields(layer);
        var fields = [];
        array.forEach(_fields, function (f) {
          if (skipFields.indexOf(f.name) === -1) {
            fields.push(f);
          }
        });
        this.fields = fields;
        this.popUpFields = this._getPopupFields(layer);
        this.advStat = aStat;
        if (typeof (test) === 'undefined') {
          //update geom options
          this._updateGeomOptions(geomType);
          if (this.advStat.url) {
            if (typeof (this.callerTab.advStat) !== 'undefined' && this.callerTab.advStat) {
              if (this.callerTab.advStat.stats) {
                this._setFields(fields);
              } else {
                this._setFields(fields, true);
              }
              var statGroup = this.callerTab.advStat.stats;
              for (var key in statGroup) {
                if (key === "count") {
                  this.chk_count.set('value', true);
                  this.featureCountLabel.set('value', statGroup[key][0].label);
                } else if (key === "area") {
                  this.chk_area.set('value', true);
                  this.featureAreaLabel.set('value', statGroup[key][0].label);
                } else if (key === "length") {
                  this.chk_length.set('value', true);
                  this.featureLengthLabel.set('value', statGroup[key][0].label);
                } else if (key === "tabCount") {
                  this.chk_count_only.set('value', statGroup[key]);
                } else {
                  array.forEach(statGroup[key], lang.hitch(this, function (exp) {
                    this._populateTabTableRow(key, exp);
                  }));
                }
              }
            } else {
              this._setFields(fields, true);
            }
            var a = this.callerTab.advStat;
            if (!a || (typeof (a) !== 'undefined' && !a.hasOwnProperty('stats'))) {
              var hasPopupFields = this.popUpFields.length > 0;
              var fll = this.fieldsList.length;
              if (this.callerTab.type === 'groupedSummary') {
                fll = 1;
                if (!hasPopupFields) {
                  this._setFields(fields);
                }
              }
              if (fll > 0) {
                var maxCount = this.callerTab.type === 'summary' ? 21 : 4;
                var x = 0;
                field_loop:
                for (var i = 0; i < fll; i++) {
                  var add = false;
                  var f = this.fieldsList[i];
                  if (hasPopupFields) {
                    var popupField = this.popUpFields[i];
                    popup_field_loop:
                    for (var ii = 0; ii < this.fieldsList.length; ii++) {
                      f = this.fieldsList[ii];
                      if (f.value === popupField) {
                        add = true;
                        break popup_field_loop;
                      }
                    }
                  }
                  if (add) {
                    x += 1;
                    if (x < maxCount) {
                      this._addTabRow(f);
                    } else {
                      break field_loop;
                    }
                  }
                }
              } else {
                domClass.add(this.btnAddField, 'btn-add-disabled');
                this.hasFields = false;
              }
            }
          }
          if ((this.callerTab.type === 'groupedSummary' && this.popUpFields.length > 0) ||
            this.callerTab.type !== 'groupedSummary') {
            this._setFields(fields);
          }
        }
      }
    },

    _validatePopupFields: function () {
      var def = new Deferred();
      this._getAllValidLayers(true).then(lang.hitch(this, function () {
        var temp_fields = [];
        for (var i = 0; i < this.popUpFields.length; i++) {
          var pf = this.popUpFields[i];
          field_loop:
          for (var ii = 0; ii < this.fields.length; ii++) {
            var f = this.fields[ii];
            if (pf === f.name) {
              temp_fields.push(f);
              break field_loop;
            }
          }
        }

        //force summary type checks
        this.callerTab.type = 'summary';
        this._setFields(temp_fields);
        var validPopupFields = this.fieldsList.length > 0;
        this._setFields(this.fields);
        var validFields = this.fieldsList.length > 0;
        def.resolve({
          layer: this.callerLayer,
          hasPopupFields: temp_fields.length > 0,
          hasFields: this.fields.length > 0,
          hasSummaryPopupFields: validPopupFields,
          hasSummaryFields: validFields,
          popUpFields: temp_fields,
          validSummaryFields: this.fieldsList,
          advStat: this.advStat
        });
      }));
      return def;
    },

    _getPopupFields: function (layer) {
      var skipFields = this.getSkipFields(layer);
      var fldInfos;
      var fields = [];
      this.objectIdField = layer.objectIdField;
      if (layer.infoTemplate) {
        fldInfos = layer.infoTemplate.info.fieldInfos;
      } else if (layer.url && layer.url.indexOf("MapServer") > -1) {
        var lID = layer.url.split("MapServer/")[1];
        var mapLayers = this.map.itemInfo.itemData.operationalLayers;
        fldInfos = null;
        for (var ii = 0; ii < mapLayers.length; ii++) {
          var lyr = mapLayers[ii];
          if (lyr.layerObject && lyr.layerObject.infoTemplates) {
            var infoTemplate = lyr.layerObject.infoTemplates[lID];
            if (infoTemplate) {
              fldInfos = infoTemplate.infoTemplate.info.fieldInfos;
              break;
            }
          }
        }
      }
      if (fldInfos) {
        for (var j = 0; j < fldInfos.length; j++) {
          var _fi = fldInfos[j];
          if (_fi && _fi.visible && skipFields.indexOf(_fi.fieldName) === -1) {
            fields.push(_fi.fieldName);
          }
        }
      }
      return fields;
    },

    checkStringWidth: function (v) {
      var visSpan = domConstruct.create("div", {
        "class": "visDivLength",
        "id": "SA_VisDiv",
        "innerHTML": v
      }, this.domNode);

      var fitsWidth = visSpan.clientWidth < 220 ? true : false;

      domConstruct.destroy(visSpan);

      var allValid = fitsWidth;
      var id = registry.byNode(this.domNode).id;
      query('.validationBox').forEach(function (node) {
        var _dijit = registry.byNode(node);
        if (id !== _dijit.id) {
          allValid = allValid ? _dijit.state !== 'Error' : allValid;
        }
      });

      var s = query('.field-picker-footer')[0];
      if (s) {
        if (!allValid) {
          html.addClass(s.children[0], 'jimu-state-disabled');
        } else {
          html.removeClass(s.children[0], 'jimu-state-disabled');
        }
      }

      return fitsWidth;
    },

    _setFields: function (pFields, checkPopup) {
      var validFieldTypes = [
      'esriFieldTypeInteger',
      'esriFieldTypeSmallInteger',
      'esriFieldTypeDouble'
      ];
      if (this.callerTab.type !== "summary") {
        validFieldTypes.push('esriFieldTypeString');
        validFieldTypes.push('esriFieldTypeDate');
      }
      var options = [];
      var popupFieldsForType = [];
      array.forEach(pFields, lang.hitch(this, function (field) {
        if (validFieldTypes.indexOf(field.type) > -1) {
          if (checkPopup) {
            if (this.popUpFields && this.popUpFields.indexOf(field.name) > -1) {
              popupFieldsForType.push(field.name);
            }
          }
          options.push({
            'label': field.alias,
            'value': field.name
          });
        }
      }));
      if (options.length < 1) {
        domClass.add(this.btnAddField, 'btn-add-disabled');
        this.hasFields = false;
      } else {
        if ((!this.test)) {
          domStyle.set(this.displayFieldsTable.domNode, 'display', "block");
          domStyle.set(this.btnAddField, "display", "inline-block");
        }
      }
      if (popupFieldsForType.length !== this.popUpFields.length) {
        this.popUpFields = popupFieldsForType;
      }
      this.fieldsList = lang.clone(options);
    },

    _populateTabTableRow: function (pKey, pTab) {
      var result = this.displayFieldsTable.addRow({});
      if (result.success && result.tr) {
        var tr = result.tr;
        this._addTabFields(tr);
        this._addTabTypes(tr);
        this._addTabLabel(tr);
        tr.selectFields.set("value", pTab.expression);
        if (this.callerTab.type === "summary" || this.callerTab.type === "groupedSummary") {
          tr.labelText.set("value", pTab.label);
          tr.selectTypes.set("value", pKey);
        }
      }
    },

    _addTabRow: function (field) {
      var numRows = this.displayFieldsTable.getRows().length;
      if (this.callerTab.type !== "summary" && numRows >= 3) {
        new Message({
          message: this.nls.max_records
        });
        return;
      }
      if (this.callerTab.type === "groupedSummary" && numRows > 0) {
        return;
      }
      var result = this.displayFieldsTable.addRow({});
      if (result.success && result.tr) {
        var tr = result.tr;
        this._addTabFields(tr);
        this._addTabTypes(tr);
        this._addTabLabel(tr);
        if (field) {
          tr.selectFields.set("value", field.value);
        }
        this._enableOk();
      }
    },

    _addTabFields: function (tr) {
      var lyrOptions = lang.clone(this.fieldsList);
      var td = query('.simple-table-cell', tr)[0];
      if (td) {
        var className;
        if (this.callerTab.type === "summary") {
          className = "shortSelect";
        } else {
          className = "longSelect";
        }
        var tabLayers = new Select({
          style: {
            height: "24px",
            width: "100%"
          },
          "class": className,
          options: lyrOptions
        });
        tabLayers.placeAt(td);
        tabLayers.startup();
        tr.selectFields = tabLayers;
      }
    },

    _addTabLabel: function (tr) {
      if (this.callerTab.type !== "summary" && this.callerTab.type !== "groupedSummary") {
        return;
      }
      var td = query('.simple-table-cell', tr)[1];
      var labelTextBox = new ValidationTextBox({
        style: {
          width: "100%",
          height: "24px"
        },
        "class": "validationBox"
      });

      labelTextBox.invalidMessage = this.nls.invalid_string_width;
      labelTextBox.placeAt(td);
      labelTextBox.startup();
      labelTextBox.validator = this.checkStringWidth;
      tr.labelText = labelTextBox;
    },

    _addTabTypes: function (tr) {
      if (this.callerTab.type !== "summary" && this.callerTab.type !== "groupedSummary") {
        return;
      }
      var typeOptions = lang.clone(this.operationsList);
      var td = query('.simple-table-cell', tr)[2];
      if (td) {
        var tabTypes = new Select({
          style: {
            width: "100%",
            height: "24px"
          },
          options: typeOptions
        });
        tabTypes.placeAt(td);
        tabTypes.startup();
        tr.selectTypes = tabTypes;
      }
    },

    getSkipFields: function (layer) {
      //var skipFields = ['SUBTYPE', 'SUBTYPEFIELD'];
      var skipFields = [];
      //if (layer.typeIdField && layer.typeIdField !== '') {
      //  skipFields.push(layer.typeIdField);
      //}

      if (layer.fields) {
        for (var i = 0; i < layer.fields.length; i++) {
          var f = layer.fields[i];
          if (f && f.type && f.name) {
            if (f.type === 'esriFieldTypeGeometry') {
              skipFields.push(f.name);
            }
          }
        }
      }

      if (layer.globalIdField && layer.globalIdField !== '') {
        skipFields.push(layer.globalIdField);
      }
      if (layer.objectIdField && layer.objectIdField !== '') {
        skipFields.push(layer.objectIdField);
      }
      return skipFields;
    },

    getDefaultFields: function (fields, summaryFields, type) {
      //similar to updateSummaryType
      // get the same fields that would be used as the default if
      // valid fields are found and the user never visits the field picker to explicitly define the fields
      var advStat = {
        stats: {
          fields: [],
          tabCount: false
        }
      };
      if (type !== "summary" && type !== "groupedSummary") {
        var flds = [];
        for (var i = 0; i < (fields.length < 3 ? fields.length : 3); i++) {
          var field = fields[i];
          flds.push({
            value: 0,
            expression: field.name,
            label: field.alias
          });
        }
        if (flds.length > 0) {
          advStat.stats.outFields = flds;
        }
      } else if (type === 'summary') {
        if (summaryFields && summaryFields.hasOwnProperty('length') && summaryFields.length > 0) {
          advStat.stats.sum = [];
          array.forEach(summaryFields, lang.hitch(this, function (field) {
            advStat.stats.sum.push({
              value: 0,
              expression: field.name || field.value,
              label: field.alias ? field.alias : field.label ? field.label : field.name || field.value
            });
          }));
        }
      }
      return advStat;
    },

    updateSummaryType: function () {
      var trs = this.displayFieldsTable.getRows();
      if (this.callerTab.type !== "summary" && this.callerTab.type !== "groupedSummary") {
        var flds = [];
        array.forEach(trs, function (tr) {
          flds.push({
            value: 0,
            expression: tr.selectFields.value,
            label: tr.selectFields.value
          });
        });
        if (flds.length > 0) {
          this.advStat.stats.outFields = flds;
        }
        this.advStat.stats.tabCount = this.chk_count_only.checked;
      } else {
        // count
        if (this.callerTab.type === "groupedSummary") {
          this.advStat.stats.tabCount = this.chk_count_only.checked;
        } else {
          this.advStat.stats.tabCount = this.chk_count.checked;
        }
        if (this.chk_count.checked) {
          //this.summaryLayers[0].stats.count = [
          this.advStat.stats.count = [
            {
              value: 0,
              expression: this.objectIdField,
              label: utils.stripHTML(this.featureCountLabel.value ? this.featureCountLabel.value : this.nls.count)
            }
          ];
        }
        //area
        if (this.chk_area.checked) {
          //this.summaryLayers[0].stats.area = [
          this.advStat.stats.area = [
            {
              value: 0,
              expression: this.objectIdField,
              label: utils.stripHTML(this.featureAreaLabel.value ? this.featureAreaLabel.value : this.nls.area)
            }
          ];
        }
        //length
        if (this.chk_length.checked) {
          //this.summaryLayers[0].stats.length = [
          this.advStat.stats.length = [
            {
              value: 0,
              expression: this.objectIdField,
              label: utils.stripHTML(this.featureLengthLabel.value ? this.featureLengthLabel.value : this.nls.length)
            }
          ];
        }
        // sum, avg, min, max
        array.forEach(trs, lang.hitch(this, function (tr) {
          if (typeof (this.advStat.stats[tr.selectTypes.value]) === 'undefined') {
            this.advStat.stats[tr.selectTypes.value] = [];
          }
          var statBlock = {};
          statBlock.value = 0;
          statBlock.expression = tr.selectFields.value;
          //textDirNode.innerText was coming back undefined if the widget was configured in FF
          //Field names in "advanced" summary mode were not displaying correctly when the attributes were turned off in the corresponding popup configuration
          for (var i = 0; i < tr.selectFields.options.length; i++) {
            if (tr.selectFields.options[i].value === tr.selectFields.value) {
              if (this.callerTab.type !== "groupedSummary") {
                statBlock.label = tr.labelText.value ? tr.labelText.value : tr.selectFields.options[i].label;
              } else {
                statBlock.label = tr.labelText.value;
              }
              break;
            }
          }
          if (typeof (statBlock.label) === 'undefined') {
            statBlock.label = statBlock.expression;
          }
          this.advStat.stats[tr.selectTypes.value].push(statBlock);
        }));
      }
      console.log("ADVSTAT", this.advStat);
    },

    chkCountChanged: function (v) {
      if (this.callerTab.type === "summary") {
        this.updateLabel(this.featureCountLabel, v);
        if (!v) {
          var trs = this.displayFieldsTable.getRows();
          if (trs.length === 0) {
            this._disableOk();
          } else {
            this._enableOk();
          }
        } else {
          this._enableOk();
        }
      }
    },

    chkAreaChanged: function (v) {
      this.updateLabel(this.featureAreaLabel, v);
    },

    chkLengthChanged: function (v) {
      this.updateLabel(this.featureLengthLabel, v);
    },

    updateLabel: function(c, v){
      c.set("disabled", !v);
      c.validator = this.checkStringWidth;
      c.invalidMessage = this.nls.invalid_string_width;
      if (v && c.value === '') {
        var l = '';
        if (c.id === this.featureCountLabel.id) {
          l = this.nls.count;
        } else if (c.id === this.featureAreaLabel.id) {
          l = this.nls.area;
        } else if (c.id === this.featureLengthLabel.id) {
          l = this.nls.length;
        }
        c.set("value", l);
      }
      this.validateAll();
    },

    validateAll: function(){
      var allValid = true;
      query('.validationBox').forEach(function (node) {
        var _dijit = registry.byNode(node);
        allValid = allValid ? _dijit.state !== 'Error' : allValid;
      });

      var s = query('.field-picker-footer')[0];
      if (s) {
        if (!allValid) {
          html.addClass(s.children[0], 'jimu-state-disabled');
        } else {
          html.removeClass(s.children[0], 'jimu-state-disabled');
        }
      }
    },

    _rowDeleted: function () {
      this.validateAll();
      var trs = this.displayFieldsTable.getRows();
      if (trs.length === 0) {
        if (this.callerTab.type === "summary" && this.chk_count.checked) {
          this._enableOk();
        } else {
          this._disableOk();
        }
      } else {
        this._enableOk();
      }
    },

    _disableOk: function () {
      var s = query('.field-picker-footer')[0];
      if (s) {
        html.addClass(s.children[0], 'jimu-state-disabled');
      }
    },

    _enableOk: function () {
      var s = query('.field-picker-footer')[0];
      if (s) {
        html.removeClass(s.children[0], 'jimu-state-disabled');
      }
    },

    destroy: function () {
      this.advStat = null;
    }
  });
});
