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
  'dojo/Deferred',
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/Evented',
  'dojo/text!./templates/Home.html',
  'dojo/on',
  'dojo/dom-construct',
  '../csvStore',
  './Addresses',
  './Coordinates',
  './FieldMapping',
  'esri/lang',
  'jimu/dijit/Popup'
],
  function (declare,
    lang,
    array,
    Deferred,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Evented,
    template,
    on,
    domConstruct,
    CsvStore,
    Addresses,
    Coordinates,
    FieldMapping,
    esriLang,
    Popup) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
      baseClass: 'cf-home',
      declaredClass: 'CriticalFacilities.Home',
      templateString: template,
      _started: null,
      label: 'Home',
      parent: null,
      nls: null,
      map: null,
      appConfig: null,
      config: null,
      theme: '',
      isDarkTheme: '',
      styleColor: '',
      _geocodeSources: null,
      _fsFields: [],
      _singleFields: [],
      _multiFields: [],
      _childViews: [],
      singleEnabled: false,
      multiEnabled: false,
      xyEnabled: false,

      constructor: function (options) {
        lang.mixin(this, options);
        this._initBaseArgs();
      },

      _initBaseArgs: function () {
        this._baseArgs = {
          nls: this.nls,
          map: this.map,
          parent: this.parent,
          config: this.config,
          appConfig: this.appConfig,
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        };
      },

      postCreate: function () {
        this.inherited(arguments);
        this.pageInstruction.innerHTML = esriLang.substitute({
          layer: this.parent.editLayer.name
        }, this.nls.startPage.startPageInstructions);
      },

      startup: function () {
        this._started = true;
        this.inDrop = false;
        if (this.parent.domNode) {
          //in the normal working scenerio this causes 2 drop events to be fired
          // using inDrop flag to check if a drop event occurs before the current drop event completes
          this.own(on(this.parent.domNode, "dragenter", this.onDragEnter));
          this.own(on(this.parent.domNode, "dragover", this.onDragOver));
          this.own(on(this.parent.domNode, "drop", lang.hitch(this, this.onDrop)));
        }

        this.own(on(this.map.container, "dragenter", this.onDragEnter));
        this.own(on(this.map.container, "dragover", this.onDragOver));
        this.own(on(this.map.container, "drop", lang.hitch(this, this.onDrop)));
        this.own(on(this.fileNode, "change", lang.hitch(this, this.onDrop)));
      },

      onShown: function () {

      },

      _clearResults: function (showInfoWindow) {
        if (!showInfoWindow) {
          this.map.infoWindow.hide();
          this.inDrop = false;
        }
      },

      setStyleColor: function (styleColor) {
        this.styleColor = styleColor;
      },

      updateImageNodes: function () {
        //TODO toggle white/black images
      },

      updateTheme: function (theme) {
        this.theme = theme;
      },

      validate: function (type, result) {
        var def = new Deferred();
        if (type === 'next-view') {
          def.resolve(this._nextView(result));
        } else if (type === 'back-view') {
          this._backView(result).then(function (v) {
            def.resolve(v);
          });
        } else {
          this._homeView(result).then(function (v) {
            def.resolve(v);
          });
        }
        return def;
      },

      _nextView: function (nextResult) {
        if (nextResult.navView.label === this.pageContainer.views[1].label) {
          this.pageContainer.toggleController(false);
        }
        return true;
      },

      _backView: function (backResult) {
        var def = new Deferred();
        if (backResult.navView.label === this.label) {
          //for validate
          this.pageContainer.toggleController(true);
          def.resolve(true);
        }
        return def;
      },

      _homeView: function (backResult) {
        var def = new Deferred();
        if (backResult.navView.label === this.label) {
          //for validate
          this.pageContainer.toggleController(true);
          def.resolve(true);
        }
        return def;
      },

      _clearMapping: function () {
        this.parent._locationMappingComplete = false;
        this.parent._fieldMappingComplete = false;
      },

      onDragEnter: function (event) {
        event.preventDefault();
      },

      onDragOver: function (event) {
        event.preventDefault();
      },

      onDrop: function (event) {
        if (!this.inDrop) {
          this.inDrop = true;
          if (this.csvStore) {
            this.csvStore.clear();
          }

          var files;
          if (event.dataTransfer) {
            event.preventDefault();
            files = event.dataTransfer.files;
          } else if (event.currentTarget) {
            files = event.currentTarget.files;
          }

          if (files && files.length > 0) {
            var file = files[0];//single file for the moment
            if (file.name.indexOf(".csv") !== -1) {
              this.csvStore = new CsvStore({
                file: file,
                fsFields: this._fsFields,
                map: this.map,
                geocodeSources: this._geocodeSources,
                nls: this.nls,
                appConfig: this.appConfig,
                editLayer: this.parent.editLayer,
                symbol: this.parent._symbol
              });
              this.csvStore.handleCsv().then(lang.hitch(this, function (obj) {
                this._updatePageContainer(obj);
                this.inDrop = false;
              }));
            } else {
              this.inDrop = false;
            }
          } else {
            this.inDrop = false;
          }
        }
      },

      _initCoordinatesView: function (obj) {
        return new Coordinates(lang.mixin({
          fields: this._getFields(obj, true),
          xField: this.config.xyFields[0],
          yField: this.config.xyFields[1]
        }, this._baseArgs));
      },

      _initAddressView: function (obj) {
        return new Addresses(lang.mixin({
          singleFields: this._singleFields,
          multiFields: this._multiFields,
          fields: this._getFields(obj, false),
          multiEnabled: this.multiEnabled,
          singleEnabled: this.singleEnabled
        }, this._baseArgs));
      },

      _initFieldMappingView: function (obj) {
        return new FieldMapping(lang.mixin({
          targetFields: obj.fsFields,
          sourceFields: this._getFields(obj, false)
        }, this._baseArgs));
      },

      _getFields: function (obj, coordFields) {
        //coord fields
        var fields = [];
        array.forEach(obj.fields, function (field) {
          var fieldType = obj.fieldTypes[field];
          var pushField = (coordFields && fieldType && (fieldType.supportsInt || fieldType.supportsFloat)) ?
            true : !coordFields ? true : false;
          if (pushField) {
            fields.push({
              label: field,
              value: field,
              type: fieldType
            });
          }
        });
        return fields;
      },

      _updatePageContainer: function (obj) {
        var startPage = this.pageContainer.getViewByTitle('StartPage');
        startPage.csvStore = this.csvStore;

        if (this.xyEnabled) {
          var coordinatesView = this._initCoordinatesView(obj);
          this.pageContainer.addView(coordinatesView);
        }

        if (this.singleEnabled || this.multiEnabled) {
          var addressView = this._initAddressView(obj);
          this.pageContainer.addView(addressView);
        }

        var fieldMappingView = this._initFieldMappingView(obj);
        this.pageContainer.addView(fieldMappingView);

        //go to the next page to start the user workflow
        this.pageContainer._nextView();
      },

      verifyClearSettings: function (backResult) {
        var def = new Deferred();

        if (backResult.navView.label === this.label) {
          var msg;
          if (this.parent._locationMappingComplete || this.parent._fieldMappingComplete ||
            this.parent._tempResultsAdded) {
            msg = this.nls.warningsAndErrors.settingsCleared;
          }

          if (msg) {
            var content = domConstruct.create('div');
            domConstruct.create('div', {
              "className": "cf-warning-icon",
              style: 'float: ' + (window.isRTL ? 'right; margin-left' : 'left; margin-right') + ': 10px;'
            }, content);

            var msgPadding = 'padding-' + (window.isRTL ? 'right' : 'left') + ': 50px;';
            domConstruct.create('div', {
              innerHTML: msg,
              style: msgPadding
            }, content);

            domConstruct.create('div', {
              innerHTML: this.nls.warningsAndErrors.proceed,
              style: 'padding-top:10px; ' + msgPadding
            }, content);

            var warningMessage = new Popup({
              width: 325,
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
        } else {
          def.resolve(true);
        }
        return def;
      },

      _clearStore: function () {
        if (this.csvStore) {
          this.csvStore.clear();
        }

        if (this.map.infoWindow && this.map.infoWindow.clearFeatures) {
          this.map.infoWindow.clearFeatures();
        }

        this.fileForm.reset();
        this.parent._initPageContainer();
        this.inDrop = false;
      }
    });
  });