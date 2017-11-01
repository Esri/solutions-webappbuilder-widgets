define([
  'dojo/_base/declare',
  'jimu/BaseWidget',
  './js/UI/PageContainer',
  'dojo/on',
  'dojo/_base/lang',
  'dojo/dom-class',
  'dojo/dom-construct',
  'dojo/_base/array',
  'dojo/Deferred',
  'jimu/dijit/TabContainer3',
  'jimu/dijit/Popup',
  './js/UI/Home',
  './js/UI/Addresses',
  './js/UI/Coordinates',
  './js/UI/StartPage',
  './js/UI/LocationType',
  './js/UI/Coordinates',
  './js/UI/FieldMapping',
  './js/UI/Review',
  './js/UI/FeatureList',
  './js/UI/Feature',
  './js/csvStore'],
  function (declare,
    BaseWidget,
    PageContainer,
    on,
    lang,
    domClass,
    domConstruct,
    array,
    Deferred,
    TabContainer3,
    Popup,
    Home,
    Addresses,
    Coordinates,
    StartPage,
    LocationType,
    Coordinates,
    FieldMapping,
    Review,
    FeatureList,
    Feature,
    CsvStore) {
    return declare([BaseWidget], {
      baseClass: 'jimu-widget-critical-facilities-ui',

      _fsFields: [],
      matchedRecords: [],
      unMatchedRecords: [],
      duplicateRecords: [],
      _locationMappingComplete: false,
      _fieldMappingComplete: false,

      postCreate: function () {
        this.inherited(arguments);
        this._setThemeAndColors(this.appConfig.theme.name);
        this._initPageContainer();

        this.own(on(this.map.container, "dragenter", this.onDragEnter));
        this.own(on(this.map.container, "dragover", this.onDragOver));
        this.own(on(this.map.container, "drop", lang.hitch(this, this.onDrop)));
      },

      startup: function () {
        if (this.config.layerInfos && this.config.layerInfos.hasOwnProperty(0)) {
          this._valid = true;
          this._configLayerInfo = this.config.layerInfos[0];
          this._url = this._configLayerInfo.featureLayer.url;
          this._geocodeSources = this.config.sources;

          this._fsFields = [];
          if (this._configLayerInfo) {
            array.forEach(this._configLayerInfo.fieldInfos, lang.hitch(this, function (field) {
              if (field && field.visible) {
                this._fsFields.push({
                  name: field.fieldName,
                  value: field.type,
                  isRecognizedValues: field.isRecognizedValues
                });
              }
            }));
          }

          //switch this to layerStructure
          LayerInfos.getInstance(this.map, this.map.itemInfo).then(lang.hitch(this, function (operLayerInfos) {
            this.opLayers = operLayerInfos;
            this.editLayer = operLayerInfos.getLayerInfoById(this._configLayerInfo.featureLayer.id).layerObject;
          }));
        }
      },

      _setThemeAndColors: function (theme) {
        this.theme = theme;
      },

      _initPageContainer: function () {
        var h = new Home({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        var sp = new StartPage({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        var lt = new LocationType({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        var c = new Coordinates({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          fields: [{
            label: "Lat",
            value: "Lat",
            xSelected: true
          }, {
              label: "Lon",
              value: "Lon",
              ySelected: true
            }],
          xLabel: "Latitude",
          yLabel: "Longitude",
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        //TODO need to make a structure that will allow us to handle
        // the user defined is-recognized values and the type based recognition
        var add = new Addresses({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          singleFields: [{
            label: "Address",
            isRecognizedValues: ['Address']
          }],
          multiFields: [{
            label: "City",
            isRecognizedValues: ['City'],
          }, {
            label: "State",
            isRecognizedValues: ['State']
            }],
          fields: [{
            label: "City1",
            value: "City1",
            type: "string"
          }, {
            label: "State1",
            value: "State1",
            type: "string"
            }],
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        var f = new FieldMapping({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          targetFields: [{
            label: "Address",
            isRecognizedValues: ['Address']
          }, {
            label: "Address1",
            isRecognizedValues: ['Address1']
            }, {
              label: "Address2",
              isRecognizedValues: ['Address2']
          }, {
            label: "Address3",
            isRecognizedValues: ['Address3']
            }, {
              label: "Address4",
              isRecognizedValues: ['Address4']
            }],
          sourceFields: [{
            label: "City",
            value: "City",
            type: "string"
          }, {
            label: "State",
            value: "State",
            type: "string"
            }],
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        this._pageContainer = new PageContainer({
          views: [h, sp, lt, c, add, f],
          nls: this.nls.pageContainer,
          altHomeIndex: 1,
          appConfig: this.appConfig,
          displayControllerOnStart: false,
          parent: this
        }, this.pageNavigation);

        this.own(on(this._pageContainer, 'view-changed', lang.hitch(this, function (title) {
          console.log('view-changed: ' + title);
        })));

        this._pageContainer.startup();
      },

      _fakeLoadCSVClick: function () {
        this._pageContainer._nextView();
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
        if (nextResult.navView.label === this._pageContainer.views[1].label) {
          this._pageContainer.toggleController(false);
          this._toggleFakeButton(true);
        }
        return true;
      },

      _backView: function (backResult) {
        var def = new Deferred();

        if (backResult.navView.label === this._pageContainer.views[0].label) {
          var msg;

          if (this._locationMappingComplete && this._fieldMappingComplete) {
            msg = this.nls.warningsAndErrors.locationAndFieldMappingCleared;
          } else {
            if (this._locationMappingComplete) {
              msg = this.nls.warningsAndErrors.locationCleared;
            } else if (this._fieldMappingComplete) {
              msg = this.nls.warningsAndErrors.fieldMappingCleared;
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
                label: this.nls.shouldComeFromJimuNLS.yes,
                onClick: lang.hitch(this, function () {
                  this._clearMapping();
                  this._pageContainer.toggleController(true);
                  this._toggleFakeButton(false);
                  warningMessage.close();
                  warningMessage = null;
                  def.resolve(true);
                })
              }, {
                  label: this.nls.shouldComeFromJimuNLS.no,
                classNames: ['jimu-btn-vacation'],
                onClick: lang.hitch(this, function () {
                  this._pageContainer.selectView(backResult.currentView.index);
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
            this._pageContainer.toggleController(true);
            this._toggleFakeButton(false);
            def.resolve(true);
          }
        }
        return def;
      },

      _clearMapping: function () {
        this._locationMappingComplete = false;
        this._fieldMappingComplete = false;
      },

      _toggleFakeButton: function (isDisabled) {
        if (isDisabled) {
          if (!domClass.contains(this.fakeLoadCSV, 'display-none')) {
            domClass.add(this.fakeLoadCSV, 'display-none');
          }
        } else {
          if (domClass.contains(this.fakeLoadCSV, 'display-none')) {
            domClass.remove(this.fakeLoadCSV, 'display-none');
          }
        }
      },

      onDragEnter: function (event) {
        event.preventDefault();
      },

      onDragOver: function (event) {
        event.preventDefault();
      },

      onDrop: function (event) {
        if (this._valid) {
          if (this.myCsvStore) {
            this.myCsvStore.clear();
          }
          event.preventDefault();

          var dataTransfer = event.dataTransfer,
            files = dataTransfer.files,
            types = dataTransfer.types;

          if (files && files.length > 0) {
            var file = files[0];//single file for the moment
            if (file.name.indexOf(".csv") !== -1) {
              this.myCsvStore = new CsvStore({
                file: file,
                fsFields: this._fsFields,
                map: this.map,
                geocodeSources: this._geocodeSources,
                nls: this.nls,
                appConfig: this.appConfig,
                unMatchedContainer: this.unMatchedContainer
              });
              this.myCsvStore.handleCsv().then(lang.hitch(this, function (obj) {
                this._updateFieldControls(this.schemaMapTable, obj, true, true, obj.fsFields, 'keyField');
                if (this.xyEnabled) {
                  this._updateFieldControls(this.xyTable, obj, true, true, this.xyFields, 'keyField');
                }
                if (this.singleEnabled) {
                  this._updateFieldControls(this.addressTable, obj, false, true, this.singleAddressFields, 'label');
                }
                if (this.multiEnabled) {
                  this._updateFieldControls(this.addressMultiTable, obj, false, true, this.multiAddressFields, 'label');
                }
                this.validateValues();
                domStyle.set(this.schemaMapInstructions, "display", "none");
                domStyle.set(this.mainContainer, "display", "block");
              }));
            }
            this.panalManager.openPanel(this.getPanel());
          }
        }
      },

    });
  });