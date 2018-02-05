///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 - 2016 Esri. All Rights Reserved.
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

define(['dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dojo/dom-construct',
  'dojo/dom-class',
  'dijit/form/ValidationTextBox',
  'dijit/form/Select',
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/Evented',
  'dojo/text!./templates/Feature.html',
  'dojo/Deferred',
  './FeatureToolbar',
  'esri/tasks/query',
  'jimu/dijit/Popup'
],
  function (declare,
    lang,
    array,
    domConstruct,
    domClass,
    ValidationTextBox,
    Select,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Evented,
    template,
    Deferred,
    FeatureToolbar,
    Query,
    Popup) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
      baseClass: 'cf-feature',
      declaredClass: 'CriticalFacilities.Feature',
      templateString: template,
      _started: null,
      label: 'Feature',
      parent: null,
      nls: null,
      map: null,
      appConfig: null,
      config: null,
      _featureToolbar: null,
      fields: [],
      feature: null,
      fileAddress: {}, //TODO need to make this work..for now since we have not discussed exposing the address fields...just store the address details here so they could be passed to the toolbar to support locate
      isDuplicate: false,
      _useGeomFromFile: false,
      _useGeomFromLayer: true,
      _useValuesFromFile: false,
      _useValuesFromLayer: true,
      _featureExpanded: true,
      _locationExpanded: false,
      theme: '',
      isDarkTheme: '',
      styleColor: 'black',
      layer: null,
      _changedFileAttributeRows: [],
      _changedLayerAttributeRows: [],
      _changedAddressRows: [],
      _editToolbar: null,
      _featureQuery: null,
      _skipFields: [],
      csvStore: null, //used to get _geocodeSources for reverse geocode

      //TODO Should matched support the idea of being able to flag a feature as duplicate?? this would allow for possibility
      //TODO validation logic for each control should be defined based on field type from layer
      //TODO handle dates, domains, and subtypes

      constructor: function (options) {
        lang.mixin(this, options);
      },

      postCreate: function () {
        this.inherited(arguments);
        this._initToolbar(this.featureToolbar);
      },

      _initSkipFields: function (fields) {
        //these fields are needed for interactions with the feature but should not be shown in the UI
        // nor should they be persisted with the layer or shown in the popup
        //TODO derive these from the csvStore so they don't go out of sync if csvStore is updated
        this._skipFields = ["DestinationOID", "matchScore", "hasDuplicateUpdates",
          "duplicateState", this.layer.objectIdField];
        array.forEach(fields, lang.hitch(this, function (f) {
          if (f.name.indexOf(this.csvStore.matchFieldPrefix) > -1) {
            this._skipFields.push(f.name);
          }
        }));
      },

      startup: function () {
        var fields = this.feature.fieldInfo;
        this._initSkipFields(fields);
        this._initRows(fields, this.featureControlTable);
        if (this.isDuplicate) {
          this._initDuplicateReview(fields);
        } else {
          this._initStandardReview();
        }

        this._getFeature().then(lang.hitch(this, function (f) {
          this._feature = f;
          this._featureToolbar._panToAndSelectFeature(f);
        }));

        this._getEditFeature().then(lang.hitch(this, function (f) {
          this._editFeature = f;
          if (this.isDuplicate && this._editFeature && this._editFeature.geometry) {
            //this._featureToolbar._reverseLocate(this._editFeature.geometry).then(lang.hitch(this, function (result) {
            //this._featureToolbar._originalValues.editAddress = result.address;
            this._toggleLocationControls(true);
            //}));
          }
        }));
        this.onShown();
      },

      onShown: function () {
        //TODO thought with this being set is that we could show a check mark
        // on the list page by the item to indicate that they have at least seen it
        this._isReviewed = true;
        this._featureToolbar._disableEdit();
        this._showView();
        this._featureToolbar._panToAndSelectFeature((this.isDuplicate && this._useGeomFromLayer) ?
          this._editFeature : this._feature);
        this.isShowing = true;
        this.pageContainer.nextDisabled = false;
        this.pageContainer.backDisabled = false;
      },

      onHidden: function () {
        this.isShowing = false;
      },

      validate: function (type, result) {
        var def = new Deferred();
        if (type === 'next-view') {
          def.resolve(this._nextView());
        } else if (type === 'back-view') {
          def.resolve(this._backView());
        } else {
          this._homeView(result).then(function (v) {
            def.resolve(v);
          });
        }
        return def;
      },

      _nextView: function () {
        return true;
      },

      _backView: function () {
        return true;
      },

      _homeView: function (backResult) {
        var def = new Deferred();
        var homeView = this.pageContainer.getViewByTitle('Home');
        homeView.verifyClearSettings(backResult).then(function (v) {
          def.resolve(v);
        });
        return def;
      },

      _showView: function () {
        domClass.remove(this.featureTable, 'display-none');
        domClass.remove(this.featureToggleTable, 'display-none');
        domClass.remove(this.locationSyncTable, 'display-none');
        domClass.remove(this.locationControlTable, 'display-none');
        domClass.remove(this.locationControlToggleTable, 'display-none');
        domClass.remove(this.featureToolbarTable, 'display-none');
        if (this.isDuplicate) {
          domClass.remove(this.reviewText, 'display-none');
        }
        this._updateInfoRows();
      },

      _getFeature: function () {
        var def = new Deferred();
        var oidFieldName = this.layer.objectIdField;
        var oidField = this.feature.fieldInfo.filter(function (f) {
          return f.name === oidFieldName;
        });

        this._featureQuery = new Query();
        this._featureQuery.objectIds = [oidField[0].value];

        this.layer.queryFeatures(this._featureQuery).then(lang.hitch(this, function (f) {
          def.resolve(f.features[0]);
        }));
        return def;
      },

      _getEditFeature: function () {
        var def = new Deferred();
        var destinationOID = 'DestinationOID';
        var destinationOIDField = this.feature.fieldInfo.filter(function (f) {
          return f.name === destinationOID;
        });
        if (destinationOIDField && destinationOIDField.length > 0) {
          this._editQuery = new Query();
          this._editQuery.objectIds = [destinationOIDField[0].value];

          this.parent.editLayer.queryFeatures(this._editQuery).then(lang.hitch(this, function (f) {
            def.resolve(f.features[0]);
          }));
        } else {
          def.resolve();
        }
        return def;
      },

      _initStandardReview: function () {
        this._useValuesFromFile = true;
        this._useValuesFromLayer = false;
      },

      _initDuplicateReview: function (fields) {
        this._initDuplicateSelect();
        this._initDuplicateReviewRows(fields);
        domClass.add(this.featureToolbar, 'display-none');
      },

      _initDuplicateSelect: function () {
        var fromSelect = new Select({
          style: {
            display: "table",
            width: "100%",
            height: "28px"
          },
          options: [{
            label: this.nls.review.duplicateAction,
            value: 'no-change',
            selected: true
          }, {
            label: this.nls.remove,
            value: 'skip'
          }, {
            label: this.nls.review.isDuplicateMakeChange,
            value: 'make-change'
          }, {
            label: this.nls.save,
            value: 'not-duplicate'
          }],
          onChange: lang.hitch(this, this._updateDuplicateUI)
        });
        this._duplicateFlag.fromSelect = fromSelect;
        domConstruct.place(fromSelect.domNode, this._duplicateFlag);
        fromSelect.startup();
      },

      _updateDuplicateUI: function (v) {
        this._updateDuplicateAttributes(v, null);
        this._featureToolbar._disableEdit();

        if (v === 'make-change') {
          domClass.remove(this.featureToolbar, 'display-none');
        } else {
          domClass.add(this.featureToolbar, 'display-none');
        }

        if (v === 'not-duplicate') {
          //locate and move to the match list row
          this._showShouldLocateFeaturePopup().then(lang.hitch(this, function (shouldLocate) {
            if (shouldLocate) {
              this.resetAddressValues(this._featureToolbar._originalValues, v);
              this._featureToolbar._locateFeature(true).then(lang.hitch(this, function () {
                //move to the appropriate list and message the user about what happened
                var movedPopup = new Popup({
                  titleLabel: this.nls.review.featureLocated,
                  width: 400,
                  autoHeight: true,
                  content: domConstruct.create('div', {
                    innerHTML: this.nls.warningsAndErrors.itemMoveMatch,
                    style: "padding-bottom: 10px;"
                  }),
                  buttons: [{
                    label: this.nls.ok,
                    onClick: lang.hitch(this, lang.hitch(this, function () {
                      movedPopup.close();
                      movedPopup = null;
                    }))
                  }],
                  onClose: lang.hitch(this, function () {
                    movedPopup = null;
                    this._featureToolbar._save(true);
                  })
                });
              }));
            } else {
              this._duplicateFlag.fromSelect.set('value', 'no-change');
            }
          }));
        }
      },

      _updateDuplicateAttributes: function (duplicateState, hasDuplicateUpdates) {
        //TODO does this need to update _feature and feature?
        this._feature.attributes.duplicateState = duplicateState !== null ? duplicateState :
          this._feature.attributes.duplicateState;

        this._feature.attributes.hasDuplicateUpdates = hasDuplicateUpdates !== null ? hasDuplicateUpdates :
          this._feature.attributes.hasDuplicateUpdates;
      },

      _showShouldLocateFeaturePopup: function () {
        var def = new Deferred();
        var content = domConstruct.create('div');

        domConstruct.create('div', {
          innerHTML: this.nls.warningsAndErrors.itemWillBeLocated,
          style: "padding-bottom: 10px;"
        }, content);

        domConstruct.create('div', {
          innerHTML: this.nls.warningsAndErrors.proceed
        }, content);

        var savePopup = new Popup({
          titleLabel: this.nls.review.locateFeature,
          width: 400,
          autoHeight: true,
          content: content,
          buttons: [{
            label: this.nls.yes,
            onClick: lang.hitch(this, function () {
              savePopup.close();
              savePopup = null;
              def.resolve(true);
            })
          }, {
            label: this.nls.no,
            onClick: lang.hitch(this, function () {
              savePopup.close();
              savePopup = null;
              def.resolve(false);
            })
          }],
          onClose: function () {
            savePopup = null;
          }
        });

        return def;
      },

      _initDuplicateReviewRows: function (fields) {
        var tr = domConstruct.create('tr', {
          className: "bottom-border",
          isHeaderRow: true
        }, this.reviewTable);
        domConstruct.create('td', {
          className: "text-left"
        }, tr);
        var tdLabel = domConstruct.create('td', {
          className: "text-left"
        }, tr);
        domConstruct.create('div', {
          className: "duplicate-col-headers main-text float-left",
          innerHTML: this.nls.review.fromLayer
        }, tdLabel);

        var _tdLabel = domConstruct.create('td', {
          className: "text-left"
        }, tr);
        domConstruct.create('div', {
          className: "duplicate-col-headers main-text float-left",
          innerHTML: this.nls.review.fromFile
        }, _tdLabel);

        array.forEach(fields, lang.hitch(this, function (f) {
          if (this._skipFields.indexOf(f.name) === -1) {
            var tr = domConstruct.create('tr', {
              className: "bottom-border",
              isLabelRow: true,
              isControlRow: true
            }, this.reviewTable);
            tr.fieldName = f.name;
            tr.parent = this;
            var tdLabel = domConstruct.create('td', {
              className: "field-control-td text-left"
            }, tr);
            domConstruct.create('div', {
              className: "main-text float-left",
              innerHTML: f.label
            }, tdLabel);
            this._initLabel(tr, f.duplicateFieldInfo.value, false, false);
            this._initLabel(tr, f.value, true, false);
          }
        }));
      },

      _initToolbar: function (domNode) {
        this._featureToolbar = new FeatureToolbar({
          nls: this.nls,
          map: this.map,
          parent: this.parent,
          config: this.config,
          appConfig: this.appConfig,
          feature: this.feature,
          theme: this.theme,
          layer: this.layer,
          featureView: this,
          _editToolbar: this._editToolbar,
          csvStore: this.csvStore,
          _stageLayer: this.csvStore.matchedFeatureLayer,
          styleColor: this.styleColor
        });

        this._featureToolbar.placeAt(domNode);

        this._featureToolbar.startup();
      },

      _initRows: function (fields, table) {
        if (this.isDuplicate) {
          this._initSelectRow(this.nls.review.use, this.locationControlTable, this._useGeomChanged, "geom");
          this._initSelectRow(this.nls.review.use, this.featureControlTable, this._useValuesChanged, "values");

          var tr = domConstruct.create('tr', {
            className: "bottom-border",
            isHeaderRow: true
          }, table);
          domConstruct.create('td', {
            className: "text-left"
          }, tr);
          var tdLabel = domConstruct.create('td', {
            className: "text-left"
          }, tr);
          domConstruct.create('div', {
            className: "duplicate-col-headers main-text float-left",
            innerHTML: this.nls.review.fromLayer
          }, tdLabel);

          var _tdLabel = domConstruct.create('td', {
            className: "text-left"
          }, tr);
          domConstruct.create('div', {
            className: "duplicate-col-headers main-text float-left",
            innerHTML: this.nls.review.fromFile
          }, _tdLabel);
        }

        this._syncEnabled = Object.keys(this._parentFeatureList._syncFields).length > 0;
        if (!this._syncEnabled) {
          domClass.add(this.syncFields, 'display-none');
        } else {
          this._syncFields = this._parentFeatureList._syncFields;
        }

        var rowIndex = 0;
        //Create UI for field controls
        array.forEach(fields, lang.hitch(this, function (f) {
          if (this._skipFields.indexOf(f.name) === -1) {
            var tr = domConstruct.create('tr', {
              className: "bottom-border",
              isRadioRow: false,
              isEditRow: true,
              rowIndex: rowIndex
            }, table);
            tr.fieldName = f.name;
            tr.parent = this;
            var tdLabel = domConstruct.create('td', {
              className: "field-control-td text-left field-row-width"
            }, tr);

            domConstruct.create('div', {
              className: "main-text float-left",
              innerHTML: f.label
            }, tdLabel);

            if (this.isDuplicate) {
              this._initValidationBox(tr, f.duplicateFieldInfo.value, false, false);
            }
            this._initValidationBox(tr, f.value, true, false);

            rowIndex += 1;
          }
        }));

        //Create UI for location field control
        //TODO all of these should shift to _currentField...after fix issue with XY fields...
        this.addressFields = this.csvStore.useMultiFields ? this.csvStore.multiFields : this.csvStore.useAddr ?
          this.csvStore.singleFields : this.getXYFields(); //finally should be the xy fields

        array.forEach(this.addressFields, lang.hitch(this, function (f) {
          var tr = domConstruct.create('tr', {
            className: "bottom-border",
            isRadioRow: false,
            isEditRow: false,
            isAddressRow: true
          }, this.locationControlTable);
          tr.label = f.label;
          tr.keyField = f.keyField;
          tr.parent = this;
          var tdLabel = domConstruct.create('td', {
            className: "field-control-td text-left"
          }, tr);
          domConstruct.create('div', {
            className: "main-text float-left",
            innerHTML: f.label
          }, tdLabel);

          var matchFieldPrefix = this.csvStore.matchFieldPrefix;
          var field = this.feature.fieldInfo.filter(function (fieldInfo) {
            return fieldInfo.name === matchFieldPrefix + f.keyField;
          })[0];

          this._initValidationBox(tr, field.value, false, true);
        }));
      },

      _syncAddressInfo: function () {
        //sync location information with destination layer fields
        if (!this._featureToolbar._syncDisabled) {
          var addr = this._getAddress();
          this._updateAddressFields(addr, true);
          this._featureToolbar._hasAddressEdit = false;
          this._featureToolbar._updateSync(true);
        }
      },

      _locate: function () {
        this._featureToolbar._locate();
      },

      getXYFields: function () {
        this._featureToolbar._isAddressFeature = false;
        var coordinatesView = this.parent._pageContainer.getViewByTitle('Coordinates');
        var xField = coordinatesView.xField;
        var yField = coordinatesView.yField;

        this._featureToolbar.xField = this.csvStore.xFieldName;
        this._featureToolbar.yField = this.csvStore.yFieldName;
        return [{
          keyField: this.csvStore.xFieldName,
          label: xField.label,
          value: this.csvStore.xFieldName
        }, {
          keyField: this.csvStore.yFieldName,
          label: yField.label,
          value: this.csvStore.yFieldName
        }];
      },

      _updateAddressFields: function (address, sync) {
        this._address = address;

        if (!sync) {
          //use the located address to update whatever fileds we have displayed
          array.forEach(this.locationControlTable.rows, lang.hitch(this, function (row) {
            var keyField = this.csvStore.useAddr && !this.csvStore.useMultiFields ? 'Match_addr' : row.keyField;
            if (row.addressValueTextBox) {
              var addr = (this._address && this._address.hasOwnProperty(keyField)) ? this._address[keyField] : '';
              row.addressValueTextBox.set('value', addr);
            }
          }));
        } else {
          //use the address to update destination layer fields
          array.forEach(this.locationControlTable.rows, lang.hitch(this, function (row) {
            if (this._syncFields.hasOwnProperty(row.keyField)) {
              var addrField = this._syncFields[row.keyField];
              for (var i = 0; i < this.featureControlTable.rows.length; i++) {
                var featureRow = this.featureControlTable.rows[i];
                if (featureRow.isEditRow && featureRow.fieldName === addrField.layerFieldName) {
                  var k = this.csvStore.matchFieldPrefix + row.keyField;
                  var val = (this._address && this._address.hasOwnProperty(k)) ? this._address[k] : '';
                  if (this.isDuplicate && this._useValuesFromLayer) {
                    featureRow.layerValueTextBox.set('value', val);
                    featureRow.layerValueTextBox.emit('keyUp');
                  } else {
                    featureRow.fileValueTextBox.set('value', val);
                    featureRow.fileValueTextBox.emit('keyUp');
                  }
                  break;
                }
              }
            }
          }));
        }
      },

      _validateAddressDifference: function () {
        //test if a difference exists between address fields and related layer fields
        var hasDifferences = false;
        array.forEach(this.locationControlTable.rows, lang.hitch(this, function (row) {
          if (this._syncFields && this._syncFields.hasOwnProperty(row.keyField) && !hasDifferences) {
            var value = row.addressValueTextBox.displayedValue;
            var addrField = this._syncFields[row.keyField];
            for (var i = 0; i < this.featureControlTable.rows.length; i++) {
              var featureRow = this.featureControlTable.rows[i];
              if (featureRow.isEditRow && featureRow.fieldName === addrField.layerFieldName && !hasDifferences) {
                if (this.isDuplicate && this._useValuesFromLayer) {
                  hasDifferences = featureRow.layerValueTextBox.displayedValue !== value;
                } else {
                  hasDifferences = featureRow.fileValueTextBox.displayedValue !== value;
                }
                break;
              }
            }
          }
        }));
        return hasDifferences;
      },

      _getAddress: function () {
        this._address = {};
        //use the located address to update whatever fileds we have displayed
        array.forEach(this.locationControlTable.rows, lang.hitch(this, function (row) {
          //var keyField = this.csvStore.useAddr && !this.csvStore.useMultiFields ? this.csvStore.matchFieldPrefix + row.keyField : row.keyField;
          if (row.addressValueTextBox) {
            this._address[this.csvStore.matchFieldPrefix + row.keyField] = row.addressValueTextBox.value;
          }
        }));

        return this._address;
      },

      _getAddressFieldsValues: function () {
        //get the address or coordinates from the textbox controls
        var address = {};
        array.forEach(this.locationControlTable.rows, function (row) {
          if (row.addressValueTextBox) {
            address[row.keyField] = row.addressValueTextBox.value;
          }
        });
        return address;
      },

      _initLabel: function (tr, value, isFile, isAddress) {
        var tdControl = domConstruct.create('td', {
          className: 'field-control-td field-row-width2'
        }, tr);
        var valueTextBox = new ValidationTextBox({
          style: {
            width: "100%",
            height: "33px"
          },
          title: value,
          invalidMessage: this.nls.review.valuesDoNotMatch
        });
        valueTextBox.set("value", value);
        valueTextBox.set("readonly", true);
        valueTextBox.placeAt(tdControl);
        valueTextBox.startup();
        valueTextBox.isFile = isFile;
        valueTextBox.isAddress = isAddress;
        valueTextBox.row = tr;
        valueTextBox.parent = this;
        if (isFile) {
          tr.fileValueTextBox = valueTextBox;
          tr.fileValue = value;
        } else if (isAddress) {
          tr.addressValueTextBox = valueTextBox;
          tr.addressValue = value;
        } else {
          tr.layerValueTextBox = valueTextBox;
          tr.layerValue = value;
        }

        if (isFile) {
          valueTextBox.validator = this._valuesMatch;
          valueTextBox.validate();
        }
      },

      _initValidationBox: function (tr, value, isFile, isAddress) {
        var tdControl = domConstruct.create('td', {
          className: 'field-control-td',
          colspan: this.isDuplicate ? 1 : 2
        }, tr);
        var valueTextBox = new ValidationTextBox({
          style: {
            width: "100%",
            height: "33px"
          },
          title: value
        });
        valueTextBox.set("value", this.isDuplicate && isAddress ? '' : value);
        valueTextBox.placeAt(tdControl);
        valueTextBox.startup();
        valueTextBox.isFile = isFile;
        valueTextBox.isAddress = isAddress;
        valueTextBox.row = tr;
        valueTextBox.parent = this;
        if (isFile) {
          tr.fileValueTextBox = valueTextBox;
          tr.fileValue = value;
        } else if (isAddress) {
          tr.addressValueTextBox = valueTextBox;
          tr.addressValue = value;
        } else {
          tr.layerValueTextBox = valueTextBox;
          tr.layerValue = value;
        }

        valueTextBox.on("keyUp", function (v) {
          var valueChanged;
          var changeIndex;
          var newValue = typeof (v.srcElement.value) !== 'undefined' ?
            this.parent._getValue(v.srcElement.value) : this.value;
          if (this.isAddress) {
            valueChanged = newValue !== this.parent._getValue(this.row.addressValue);
            changeIndex = this.parent._changedAddressRows.indexOf(this.row.rowIndex);
            if (changeIndex === -1 && valueChanged) {
              this.parent._changedAddressRows.push(this.row.rowIndex);
            } else if (changeIndex > -1 && !valueChanged) {
              this.parent._changedAddressRows.splice(changeIndex, 1);
            }
            this.parent.emit('address-change', this.parent._changedAddressRows.length > 0);
          } else {
            var rfv = this.parent._getValue(this.row.fileValue);
            var rlv = this.parent._getValue(this.row.layerValue);
            valueChanged = this.isFile ? newValue !== rfv : newValue !== rlv;
            var rows = this.isFile ? this.parent._changedFileAttributeRows : this.parent._changedLayerAttributeRows;
            changeIndex = rows.indexOf(this.row.rowIndex);
            if (changeIndex === -1 && valueChanged) {
              rows.push(this.row.rowIndex);
            } else if (changeIndex > -1 && !valueChanged) {
              rows.splice(changeIndex, 1);
            }
            this.parent.emit('attribute-change', rows.length > 0);
          }
        });
      },

      _valuesMatch: function () {
        if (this.row.fileValueTextBox && this.row.layerValueTextBox) {
          return this.row.fileValueTextBox.value === this.row.layerValueTextBox.value;
        } else {
          return true;
        }
      },

      _validateValues: function () {
        //this function is used to test when duplicate and you switch between file and layer
        array.forEach(this.featureControlTable.rows, lang.hitch(this, function (row) {
          if (row.isEditRow) {
            var fvtb = this._getValue(row.fileValueTextBox.value);
            var fv = this._getValue(row.fileValue);
            var lvtb = this._getValue(row.layerValueTextBox.value);
            var lv = this._getValue(row.layerValue);

            if (row.parent._useValuesFromFile) {
              if ((fvtb !== fv || fvtb !== lv)) {
                this._changedFileAttributeRows.push(row.rowIndex);
              }
            }
            if (row.parent._useValuesFromLayer) {
              if (lvtb !== lv) {
                this._changedLayerAttributeRows.push(row.rowIndex);
              }
            }
          }
        }));
        var rows = this._useValuesFromFile ? this._changedFileAttributeRows : this._changedLayerAttributeRows;
        this.emit('attribute-change', rows.length > 0);
      },

      _getValue: function (v) {
        return [null, undefined, ""].indexOf(v) === -1 ? v : '';
      },

      _validateGeoms: function () {
        var aEdit = this._featureToolbar._hasAttributeEdit;
        var gEdit = this._featureToolbar._hasGeometryEdit;
        if (!this._useGeomFromLayer) {
          //when using geom from file only attributes matter unless we have a geom edit
          if (gEdit) {
            this._featureToolbar._updateSaveAndCancel(!aEdit && !gEdit);
          } else {
            this._featureToolbar._updateSaveAndCancel(!aEdit);
          }
        } else {
          //when useing geom from layer only attribute edits matter
          this._featureToolbar._updateSaveAndCancel(!aEdit);
        }
      },

      _initSelectRow: function (useString, table, func, type) {
        var tr = domConstruct.create('tr', {
          className: "task-instruction-row bottom-border",
          isRadioRow: true, //TODO update all uses of this...leaving for now
          isEditRow: false
        }, table);
        tr.radioButtons = [];
        tr.useType = type;

        var tdUseLabel = domConstruct.create('td', {}, tr);
        domConstruct.create('div', {
          className: "main-text float-left pad-left-10",
          innerHTML: useString
        }, tdUseLabel);

        this._createSelect(tr, func);
      },

      _createSelect: function (tr, func) {
        var td = domConstruct.create('td', {
          colspan: 2,
          className: "field-control-td"
        }, tr);

        var fromSelect = new Select({
          style: {
            display: "table",
            width: "100%",
            height: "28px"
          },
          options: [{
            label: this.nls.review.fromLayer,
            value: 'layer',
            selected: true
          }, {
            label: this.nls.review.fromFile,
            value: 'file'
          }],
          onChange: lang.hitch(this, func)
        });
        tr.fromSelect = fromSelect;
        domConstruct.place(fromSelect.domNode, td);
        fromSelect.startup();
      },

      _useGeomChanged: function (value) {
        var v = value === 'file';
        this._useGeomFromFile = v;
        this._useGeomFromLayer = !v;
        if (v) {
          this._featureToolbar._enableEdit(true);
          this.resetAddressValues(this._featureToolbar._originalValues);
        } else {
          this._featureToolbar._enableEdit(false);
        }
        if (v && !this._hasBeenLocatedForFile) {
          if (!this._hasBeenLocatedForFile) {
            this._featureToolbar._locateFeature().then(lang.hitch(this, function (result) {
              this._featureToolbar._originalValues.duplicateGeometry = result.feature.geometry;
              this._hasBeenLocatedForFile = true;
              var features = [result.feature, this._editFeature];
              if ((result.feature.geometry.x !== this._editFeature.geometry.x) ||
                (result.feature.geometry.y !== this._editFeature.geometry.y)) {
                //zoom to extent of both features and highlight both
                if (this.map && this.map.extent && this.map.extent.contains) {
                  if (!this.map.extent.contains(result.feature.geometry) ||
                    !this.map.extent.contains(this._editFeature.geometry)) {
                    this.csvStore._zoomToData(features);
                  }
                }else {
                  this.csvStore._zoomToData(features);
                }
              }
              this._featureToolbar._flashFeatures(features);
              this._validateGeoms();
            }));
          }
        } else {
          var geom = this._useGeomFromFile ? this._featureToolbar._originalValues.duplicateGeometry :
            this._editFeature.geometry;
          this._featureToolbar._updateFeature(geom, null, false, true);
          this._featureToolbar._flashFeatures([v ? this._feature : this._editFeature]);
          this._validateGeoms();
        }

        if (this._useGeomFromLayer) {
          this._updateAddressFields(this._featureToolbar._originalValues.editAddress, false);
        }
        this._toggleLocationControls(false);

        if (this._syncFields) {
          this._featureToolbar._updateSync(!this._validateAddressDifference());
        }
      },

      _toggleFeature: function () {
        this._featureExpanded = !this._featureExpanded;
        if (this._featureExpanded) {
          this._locationExpanded = false;
        }
        this._updateInfoRows();
      },

      _toggleLocation: function () {
        this._locationExpanded = !this._locationExpanded;
        if (this._locationExpanded) {
          this._featureExpanded = false;
        }
        this._updateInfoRows();
      },

      _updateInfoRows: function () {
        //toggle feature row
        this._updateRow(this._featureExpanded, this.featureInformation, this.toggleFeature);

        //toggle location row
        this._updateRow(this._locationExpanded, this.locationInformation, this.toggleLocation);
      },

      _updateRow: function (v, displayNode, imageNode) {
        var upImages = ['bg-toggle-up-img', 'bg-toggle-up-img-white'];
        var downImages = ['bg-toggle-down-img', 'bg-toggle-down-img-white'];
        if (v) {
          domClass.remove(displayNode, 'display-none');
        } else {
          domClass.add(displayNode, 'display-none');
        }
        this._updateImageNode(v ? upImages : downImages, v ? downImages : upImages, imageNode);
      },

      _updateImageNode: function (addImages, removeImages, node) {
        //add/remove the apporpriate images
        var isDark = this._featureToolbar._darkThemes.indexOf(this.theme) > -1;
        domClass.remove(node, isDark ? removeImages[1] : removeImages[0]);
        domClass.add(node, isDark ? addImages[1] : addImages[0]);
      },

      _toggleLocationControls: function (disabled) {
        //address rows
        //when using geom from layer geocode and reverse geocode are disabled
        var _disabled = (this.isDuplicate && this._useGeomFromLayer) ? true : disabled;
        if (this.locationControlTable) {
          array.forEach(this.locationControlTable.rows, function (row) {
            if (row.fromSelect) {
              row.fromSelect.set('disabled', disabled);
            }
            if (row.isAddressRow) {
              if (row.addressValueTextBox) {
                row.addressValueTextBox.set('disabled', _disabled);
              }
            }
          });
        }
      },

      _useValuesChanged: function (value) {
        var v = value === 'file';
        this._useValuesFromFile = v;
        this._useValuesFromLayer = !v;
        if (!this._featureToolbar._editDisabled) {
          this._toggleEnabled(v);
        }
        this._validateValues();
        if (this._syncFields) {
          this._featureToolbar._updateSync(!this._validateAddressDifference());
        }
      },

      _toggleEnabled: function (isFile) {
        array.forEach(this.featureControlTable.rows, function (row) {
          if (!row.isRadioRow) {
            if (row.fileValueTextBox) {
              row.fileValueTextBox.set('disabled', !isFile);
            }
            if (row.layerValueTextBox) {
              row.layerValueTextBox.set('disabled', isFile);
            }
          }
        });
      },

      _toggleEditControls: function (disabled) {
        if (this.featureControlTable) {
          array.forEach(this.featureControlTable.rows, function (row) {
            if (row.isRadioRow) {
              row.fromSelect.set('disabled', disabled);
            }
            if (row.isEditRow) {
              if (row.fileValueTextBox) {
                if (disabled) {
                  row.fileValueTextBox.set('disabled', disabled);
                } else if (row.parent.isDuplicate && row.parent._useValuesFromFile) {
                  row.fileValueTextBox.set('disabled', disabled);
                } else if (!row.parent.isDuplicate) {
                  row.fileValueTextBox.set('disabled', disabled);
                }
              }
              if (row.layerValueTextBox) {
                if (disabled) {
                  row.layerValueTextBox.set('disabled', disabled);
                } else if (row.parent.isDuplicate && row.parent._useValuesFromLayer) {
                  row.layerValueTextBox.set('disabled', disabled);
                } else if (!row.parent.isDuplicate) {
                  row.layerValueTextBox.set('disabled', disabled);
                }
              }
            }
          });
        }

        //address rows
        this._toggleLocationControls(disabled);
      },

      resetAttributeValues: function (values) {
        console.log(values);
        array.forEach(this.featureControlTable.rows, lang.hitch(this, function (r) {
          if (r.fileValueTextBox) {
            r.fileValueTextBox.set('value', typeof (r.fileValue) !== 'undefined' ? r.fileValue : '');
          }
          if (r.layerValueTextBox) {
            r.layerValueTextBox.set('value', typeof (r.layerValue) !== 'undefined' ? r.layerValue : '');
          }
        }));

        this._changedFileAttributeRows = [];
        this._changedLayerAttributeRows = [];
      },

      resetAddressValues: function (values, duplicateType) {
        array.forEach(this.locationControlTable.rows, lang.hitch(this, function (r) {
          var keyField = this.csvStore.useAddr && !this.csvStore.useMultiFields ? 'Match_addr' : r.keyField;
          if (r.addressValueTextBox) {
            var addr = (this.isDuplicate && this._useGeomFromLayer && (duplicateType !== 'not-duplicate')) ?
              (values.editAddress && values.editAddress.hasOwnProperty(keyField)) ?
                values.editAddress[keyField] : undefined : r.addressValue;
            r.addressValueTextBox.set('value', typeof (addr) !== 'undefined' ? addr : '');
          }
        }));
      },

      resetGeometry: function (geometry, duplicateGeometry) {
        console.log(duplicateGeometry);
        this._feature.geometry = geometry;
        this.feature.geometry = geometry;
        this._featureToolbar._updateLayer(this.layer, null, [this._feature], null, false, true)
          .then(lang.hitch(this, function () {
            this._featureToolbar._flashFeatures([this._feature]);
          }));
        this.resetFromLayerRows();
      },

      resetFromLayerRows: function () {
        if (this.isDuplicate) {
          if (!this._featureToolbar._fileGeometryModified) {
            this._useGeomFromLayer = true;
          }
          if (!this._featureToolbar._fileValuesModified) {
            this._useValuesFromLayer = true;
          }

          array.forEach(this.featureControlTable.rows, lang.hitch(this, function (r) {
            if (r.fromSelect) {
              if ((r.useType === 'geom' && this._useGeomFromLayer) ||
                (r.useType === 'values' && this._useValuesFromLayer)) {
                r.fromSelect.set('value', 'layer');
              }
            }
          }));

          array.forEach(this.locationControlTable.rows, lang.hitch(this, function (r) {
            if (r.fromSelect) {
              if ((r.useType === 'geom' && this._useGeomFromLayer) ||
                (r.useType === 'values' && this._useValuesFromLayer)) {
                r.fromSelect.set('value', 'layer');
              }
            }
          }));
        }
      },

      setStyleColor: function (styleColor) {
        this.styleColor = styleColor;
        this._featureToolbar.styleColor = styleColor;
      },

      updateTheme: function (theme) {
        this.theme = theme;
      }
    });
  });