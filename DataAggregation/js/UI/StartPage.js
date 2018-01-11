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
  'dojo/on',
  'dojo/Deferred',
  'dijit/_WidgetBase',
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin",
  "dojo/Evented",
  "dojo/text!./templates/StartPage.html",
  'dojo/dom-construct',
  'dojo/dom-class',
  'dojo/query',
  './Review',
  'jimu/dijit/Popup'
],
  function (declare,
    lang,
    array,
    on,
    Deferred,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Evented,
    template,
    domConstruct,
    domClass,
    query,
    Review,
    Popup) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
      baseClass: 'cf-startpage',
      declaredClass: 'CriticalFacilities.StartPage',
      templateString: template,
      _started: null,
      label: 'StartPage',
      parent: null,
      nls: null,
      map: null,
      appConfig: null,
      config: null,
      theme: '',
      isDarkTheme: '',
      styleColor: '',
      state: 'mapping', //mapping or review...helps control what happens for various apsects of view navigation
      csvStore: null,
      _syncFields: {},

      constructor: function (options) {
        lang.mixin(this, options);
      },

      postCreate: function () {
        this.inherited(arguments);
        this._darkThemes = ['DartTheme', 'DashboardTheme'];
        this.updateImageNodes();
      },

      startup: function () {
        this._started = true;
        this._homeView = this.pageContainer.getViewByTitle('Home');
      },

      onShown: function () {
        this._initDependencies();
        this._validateStatus();
      },

      setStyleColor: function (styleColor) {
        this.styleColor = styleColor;
      },

      updateImageNodes: function () {
        //toggle white/black images
        var isDark = this._darkThemes.indexOf(this.theme) > -1;
        var removeClass = isDark ? 'next-arrow-img' : 'next-arrow-img-white';
        var addClass = isDark ? 'next-arrow-img-white' : 'next-arrow-img';
        var imageNodes = query('.' + removeClass, this.domNode);
        array.forEach(imageNodes, function (node) {
          domClass.remove(node, removeClass);
          domClass.add(node, addClass);
        });
      },

      updateTheme: function (theme) {
        this.theme = theme;
        this.updateImageNodes();
      },

      validate: function (type, result) {
        var def = new Deferred();
        if (type === 'next-view') {
          def.resolve(this._nextView(result));
        } else if (type === 'back-view') {
          this._backView(result).then(function (v) {
            def.resolve(v);
          });
        }
        return def;
      },

      _nextView: function (nextResult) {
        if (nextResult.navView.label === this.label) {
          this.pageContainer.toggleController(false);
        }
        if (this.parent._locationMappingComplete && this.parent._fieldMappingComplete) {
          return false;
        }
        return true;
      },

      _backView: function (backResult) {
        var def = new Deferred();

        if (backResult.navView.label === this.pageContainer.views[0].label) {
          var msg;
          if (this.parent._locationMappingComplete && this.parent._fieldMappingComplete) {
            msg = this.nls.warningsAndErrors.settingsCleared;
          } else {
            if (this.parent._locationMappingComplete) {
              msg = this.nls.warningsAndErrors.settingsCleared;
            } else if (this.parent._fieldMappingComplete) {
              msg = this.nls.warningsAndErrors.settingsCleared;
            }
          }

          if (msg) {
            var content = domConstruct.create('div');

            domConstruct.create('div', {
              innerHTML: msg
            }, content);

            domConstruct.create('div', {
              innerHTML: this.nls.warningsAndErrors.proceed,
              style: 'padding-top:10px;'
            }, content);

            var warningMessage = new Popup({
              titleLabel: this.nls.warningsAndErrors.mappingTitle,
              width: 400,
              autoHeight: true,
              content: content,
              buttons: [{
                label: this.nls.yes,
                onClick: lang.hitch(this, function () {
                  this._clearMapping();
                  this._clearStore();
                  this.pageContainer.toggleController(true);
                  warningMessage.close();
                  warningMessage = null;
                  def.resolve(true);
                })
              }, {
                label: this.nls.no,
                classNames: ['jimu-btn-vacation'],
                onClick: lang.hitch(this, function () {
                  this.pageContainer.selectView(backResult.currentView.index);
                  warningMessage.close();
                  warningMessage = null;
                  def.resolve(false);
                })
              }],
              onClose: function () {
                warningMessage = null;
              }
            });
          } else {
            //for validate
            this.pageContainer.toggleController(true);
            this._clearStore();
            def.resolve(true);
          }
        }
        return def;
      },

      _clearStore: function () {
        if (this.csvStore) {
          this.csvStore.clear();
        }
        if (this._homeView) {
          this._homeView.fileForm.reset();
        }
        this.parent._initPageContainer();
      },

      _clearMapping: function () {
        this.parent._locationMappingComplete = false;
        this.parent._fieldMappingComplete = false;
      },

      _locationMappingClick: function () {
        this.parent._locationMappingComplete = false;
        this._validateStatus();
        this._setViewByTitle('LocationType');
      },

      _schemaMappingClick: function () {
        this.parent._fieldMappingComplete = false;
        this._validateStatus();
        this._setViewByTitle('FieldMapping');
      },

      _setViewByTitle: function (title) {
        var view = this.pageContainer.getViewByTitle(title);
        this.pageContainer.selectView(view.index);
      },

      _initDependencies: function () {
        //this view needs to respond to changes in status of _fieldMappingComplete and _locationMappingComplete
        // as reported by the parent widget
        //Coordinates, Addresses, and FieldMapping views can alter the state of these properties and will
        // emit an event when they do so this just needs to respond
        if (this.pageContainer && !this._coordinatesView && !this._addressView && !this._fieldMappingView) {
          this._coordinatesView = this.pageContainer.getViewByTitle('Coordinates');
          this.own(on(this._coordinatesView, 'location-mapping-update', lang.hitch(this, function (v) {
            this.parent._locationMappingComplete = v;
            this._validateStatus();
          })));

          this._addressView = this.pageContainer.getViewByTitle('Addresses');
          this.own(on(this._addressView, 'location-mapping-update', lang.hitch(this, function (v) {
            this.parent._locationMappingComplete = v;
            this._validateStatus();
          })));

          this._fieldMappingView = this.pageContainer.getViewByTitle('FieldMapping');
          this.own(on(this._fieldMappingView, 'field-mapping-update', lang.hitch(this, function (v) {
            this.parent._fieldMappingComplete = v;
            this._validateStatus();
          })));

          this._locationTypeView = this.pageContainer.getViewByTitle('LocationType');
          if (this._locationTypeView && !this.parent._locationMappingComplete) {
            this.altNextIndex = this._locationTypeView.index;
          }
        }
      },

      _validateStatus: function () {
        //show/check mark to indicate complete status
        this._updateNode(this.locationMappingComplete, this.parent._locationMappingComplete);
        this._updateNode(this.fieldMappingComplete, this.parent._fieldMappingComplete);

        //When both are complete enable add to map...otherwise set the altNextIndex so we can navigate to the
        // appropriate next page
        var enableOk = false;
        if (this.parent._locationMappingComplete && this.parent._fieldMappingComplete && this.state === 'mapping') {
          enableOk = true;
          this.pageContainer.nextDisabled = true;
        } else if (!this.parent._locationMappingComplete && this._locationTypeView){
          this.altNextIndex = this._locationTypeView.index;
        } else if (!this.parent._fieldMappingComplete && this._fieldMappingView) {
          this.altNextIndex = this._fieldMappingView.index;
        }
        if (!enableOk) {
          this.pageContainer.nextDisabled = false;
        }
        this._updateNode(this.addToMapButton, enableOk);
      },

      _updateNode: function (node, complete) {
        //toggle complete checkmark or add to map button
        if (complete) {
          if (domClass.contains(node, 'display-none')) {
            domClass.remove(node, 'display-none');
          }
        } else {
          if (!domClass.contains(node, 'display-none')) {
            domClass.add(node, 'display-none');
          }
        }
      },

      _addToMapClick: function () {
        this._updateNode(this.addToMapButton, false);
        this._updateNode(this.progressNode, true);

        var fieldMappingResults = this._fieldMappingView._getResults();
        var locationResults = this._locationTypeView._getResults();
        this._syncFields = this._checkFields(fieldMappingResults, locationResults);
        this._locateFeatures(fieldMappingResults, locationResults);
      },

      _checkFields: function (fieldMappingResults, locationResults) {
        //test if same field is chosen for location and fieldmapping
        var matchingFields = {};
        if (locationResults && locationResults.fields) {
          array.forEach(locationResults.fields, function (field) {
            if (!matchingFields.hasOwnProperty(field.value)) {
              if (fieldMappingResults) {
                var fieldMappingKeys = Object.keys(fieldMappingResults);
                for (var i = 0; i < fieldMappingKeys.length; i++) {
                  if (fieldMappingResults[fieldMappingKeys[i]] === field.value) {
                    matchingFields[field.keyField] = {
                      layerFieldName: fieldMappingKeys[i]
                    };
                    break;
                  }
                }
              }
            }
          });
        }
        return matchingFields;
      },

      _locateFeatures: function (fieldMappingResults, locationResults) {

        this.csvStore.useMultiFields = locationResults.type === 'multi' ? true : false;
        this.csvStore.mappedArrayFields = fieldMappingResults;

        if (locationResults.type === 'single') {
          this.csvStore.addrFieldName = locationResults.fields[0].keyField;
          this.csvStore.singleFields = locationResults.fields;
        } else if (locationResults.type === 'multi') {
          this.csvStore.multiFields = locationResults.fields;
        } else if (locationResults.type === 'xy') {
          //Set xy field properties on csvStore
          //this.csvStore.useMultiFields = false;
          this.csvStore.useAddr = false;
          var f = locationResults.fields[0];
          var _f = locationResults.fields[1];
          this.csvStore.xFieldName = f.targetField === 'X' ? f.sourceField : _f.sourceField;
          this.csvStore.yFieldName = _f.targetField === 'Y' ? _f.sourceField : f.sourceField;
        }

        this.csvStore.processForm().then(lang.hitch(this, function (results) {
          //add the result view
          this._addResultView({
            matchedFeatures: this._formatFeatures(results.matchedLayer),
            matchedLayer: results.matchedLayer,
            unMatchedFeatures: this._formatFeatures(results.unMatchedLayer),
            unMatchedLayer: results.unMatchedLayer,
            duplicateFeatures: this._formatDuplicateFeatures(results.duplicateLayer,
              results.duplicateLookupList),
            duplicateLayer: results.duplicateLayer
          });

          //TODO still thinking through this but it will be necessary I believe
          this.state = 'review';

          this._reviewView = this.pageContainer.getViewByTitle('Review');

          this.pageContainer.nextDisabled = false;
          this.pageContainer.altHomeIndex = this._reviewView.index;

          this._updateNode(this.progressNode, false);
          this.pageContainer.selectView(this._reviewView.index);

        }), lang.hitch(this, function (err) {
          console.log(err);
          this._updateNode(this.progressNode, false);
        }));
      },

      _formatFeatures: function (layer) {
        var features = [];
        if (layer) {
          //var oidField = layer.objectIdField;
          var keyField = '';
          for (var i = 0; i < layer.fields.length; i++) {
            var field = layer.fields[i];
            keyField = field;
            if (field.type !== 'esriFieldTypeOID') {
              break;
            }
          }

          this._currentFields = layer.fields;
          array.forEach(layer.graphics, lang.hitch(this, function (g) {
            var fieldInfo = [];
            array.forEach(Object.keys(g.attributes), lang.hitch(this, function (k) {
              var _field = this._currentFields.filter(function (f) {
                return f.name === k;
              });
              fieldInfo.push({
                name: k,
                label: (_field && _field.hasOwnProperty('length') && _field.length === 1 && _field[0].alias) ?
                  _field[0].alias : k,
                value: g.attributes[k]
              });
            }));

            features.push({
              label: g.attributes[keyField.name],
              fieldInfo: fieldInfo,
              geometry: g.geometry,
              address: 'this will need to pass through but will support locate function'
            });
          }));
        }

        return features;
      },

      _formatDuplicateFeatures: function (layer, duplicateLookupList) {
        var features = [];
        if (layer) {
          var oidField = layer.objectIdField;
          var keyField = '';
          for (var i = 0; i < layer.fields.length; i++) {
            var field = layer.fields[i];
            keyField = field;
            if (field.type !== 'esriFieldTypeOID') {
              break;
            }
          }

          this._currentFields = layer.fields;
          array.forEach(layer.graphics, lang.hitch(this, function (g) {
            var fieldInfo = [];
            var duplicateFieldInfos = duplicateLookupList[g.attributes[oidField]];
            array.forEach(Object.keys(g.attributes), lang.hitch(this, function (k) {
              var _field = this._currentFields.filter(function (f) {
                return f.name === k;
              });
              fieldInfo.push({
                name: k,
                label: (_field && _field.hasOwnProperty('length') && _field.length === 1 && _field[0].alias) ?
                  _field[0].alias : k,
                value: g.attributes[k],
                duplicateFieldInfo: {
                  value: duplicateFieldInfos[k]
                }
              });
            }));

            features.push({
              label: g.attributes[keyField.name],
              fieldInfo: fieldInfo,
              geometry: g.geometry,
              address: 'this will need to pass through but will support locate function'
            });
          }));
        }

        return features;
      },

      _addResultView: function (results) {
        var r = new Review({
          nls: this.nls,
          map: this.map,
          parent: this.parent,
          config: this.config,
          appConfig: this.appConfig,
          matchedList: results.matchedFeatures,
          unMatchedList: results.unMatchedFeatures,
          duplicateList: results.duplicateFeatures,
          theme: this.theme,
          isDarkTheme: this.isDarkTheme,
          csvStore: this.csvStore,
          editLayer: this.parent.editLayer,
          matchedLayer: results.matchedLayer,
          unMatchedLayer: results.unMatchedLayer,
          duplicateLayer: results.duplicateLayer,
          duplicateLookupList: results.duplicateLookupList,
          _syncFields: this._syncFields
        });
        this.pageContainer.addView(r);

        this._zoomToAllFeatures([results.matchedLayer, results.unMatchedLayer, results.duplicateLayer]);
      },

      _zoomToAllFeatures: function (resultsArray) {
        var allFeatures = [];
        array.forEach(resultsArray, function (results) {
          if (results && results.graphics) {
            for (var i = 0; i < results.graphics.length; i++) {
              allFeatures.push(results.graphics[i]);
            }
          }
        });
        this.csvStore._zoomToData(allFeatures);
      }
    });
  });