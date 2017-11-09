///////////////////////////////////////////////////////////////////////////
// Copyright 2016 Esri. All Rights Reserved.
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
    'jimu/BaseWidget',
    'dojo/Evented',
    'jimu/dijit/SimpleTable',
    'dojo/dom-style',
    'dojo/dom-construct',
    'dojo/query',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dijit/form/TextBox'
],
  function (declare, _WidgetsInTemplateMixin, BaseWidget, Evented, SimpleTable, domStyle, domConstruct, query, lang, array, on, TextBox) {
    return declare([BaseWidget, _WidgetsInTemplateMixin, Evented], {
      templateString: '<div style="width: 100%; height: 100%;">' +
        '<div class="hintText">' +
          '<p>${nls.isRecognized}</p>' +
        '</div>' +
        '<div class="is-recognized-add-button" role="button">' +
          '<div class="button" data-dojo-attach-event="click:addRow">' +
            '<span class="button-text">${nls.add}</span>' +
          '</div>' +
        '</div>' +
          '<div class="is-recognized-source-list jimu-float-leading">' +
            '<div class="source-list-table" data-dojo-attach-point="sourceList"/>' +
          '</div></div>',
      baseClass: 'jimu-widget-setting-critical-facilities',
      row: null,
      values: [],
      isRecognizedValues: undefined,

      constructor: function (options) {
        this.nls = options.nls;
        this.row = options.row;
        this.fieldName = options.rowData.fieldName;
        this.label = options.rowData.label;
        this.isRecognizedValues = options.rowData.isRecognizedValues;
      },

      postMixInProperties: function(){
        this.inherited(arguments);
        this.nls.common = window.jimuNls.common;
      },

      postCreate: function () {
        this.inherited(arguments);
        this._initList();
        if (this.isRecognizedValues && this.isRecognizedValues.hasOwnProperty('length')) {
          array.forEach(this.isRecognizedValues, lang.hitch(this, function (v) {
            this.addRow(v);
          }));
        } else {
          this.addRow(this.fieldName);
          if (this.fieldName !== this.label) {
            this.addRow(this.label);
          }
        }
      },

      addRow: function(v){
        var addResult = this.sourceList.addRow({
          name: v instanceof MouseEvent ? this.nls.newNamePlaceholder : v
        });
        if (!addResult || !addResult.success) {
          console.error("add row failed ", addResult);
        }
      },

      _initList: function () {
        this.sourceList = new SimpleTable({
          autoHeight: false,
          selectable: true,
          fields: [{
            name: "name",
            title: this.nls.name,
            type: 'extension',
            hidden: false,
            create: lang.hitch(this, this._createTextBox),
            setValue: lang.hitch(this, this._setTextValue),
            getValue: lang.hitch(this, this._getTextValue)
          }, {
            name: "actions",
            title: "",
            width: "70px",
            type: "actions",
            actions: ["up", "down", "delete"]
          }]
        }, this.sourceList);
        domStyle.set(this.sourceList.domNode, 'height', '100%');
        this.sourceList.startup();
      },

      _createTextBox: function (td) {
        var labelBox = new TextBox({
          style: {
            'height': '85%',
            'width': '100%'
          }
        });
        td.labelBox = labelBox;
        domConstruct.place(labelBox.domNode, td);
      },

      _setTextValue: function (td, value) {
        td.labelBox.set('value', value);
      },

      _getTextValue: function (td) {
        return td.labelBox.get('value');
      },

      destroy: function () {

      }
    });
  });
