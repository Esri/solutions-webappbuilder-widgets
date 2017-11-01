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
  'dojo/_base/html',
  'dojo/_base/array',
  'dojo/on',
  'dojo/Deferred',
  'dijit/_WidgetBase',
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin",
  "dojo/Evented",
  "dojo/text!./StartPage.html",
  '../search',
  'dojo/dom-construct',
  'dojo/dom-class',
  'dojo/query',
  './Review'
],
  function (declare,
    lang,
    html,
    array,
    on,
    Deferred,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Evented,
    template,
    Search,
    domConstruct,
    domClass,
    query,
    Review) {
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
        this._initDependencies();
      },

      onShown: function () {
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
        //TODO...I think after I get past the fake button stuff should be able to move all of this from the widget to this view
        this.parent.validate(type, result).then(function (v) {
          def.resolve(v);
        });
        return def;
      },

      _locationMappingClick: function () {
        this._setViewByTitle('LocationType');
      },

      _schemaMappingClick: function () {
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
        if (this.parent._locationMappingComplete && this.parent._fieldMappingComplete) {
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
        var fieldMappingResults = this._fieldMappingView._getResults();
        var locationResults = this._locationTypeView._getResults();

        var locateResults = this._locateFeatures();

        this._addResultView(locateResults);

        //TODO still thinking through this
        this.state = 'review';

        this._reviewView = this.pageContainer.getViewByTitle('Review');

        this.pageContainer.nextDisabled = false;
        this.pageContainer.altHomeIndex = this._reviewView.index;
        this.pageContainer.selectView(this._reviewView.index);
      },

      _locateFeatures: function (fieldMappingResults, locationResults) {
        return {
          matchedFeatures: [{
            label: 'Bel Air Elemmentary 1',
            fieldInfo: [{
              name: 'Factility Name',
              value: 'Bel Air Elemmentary 1'
            }, {
              name: 'Managed By',
              value: 'Some Dude 1'
            }, {
              name: 'Address',
              value: '380 New York St 1'
            }, {
              name: 'City',
              value: 'Redlands 1'
            }]
          }, {
            label: 'Bel Air Elemmentary 2',
            fieldInfo: [{
              name: 'Factility Name',
              value: 'Bel Air Elemmentary 2'
            }, {
              name: 'Managed By',
              value: 'Some Dude 2'
            }, {
              name: 'Address',
              value: '380 New York St 2'
            }, {
              name: 'City',
              value: 'Redlands 2'
            }]
          }, {
            label: 'Bel Air Elemmentary 3',
            fieldInfo: [{
              name: 'Factility Name',
              value: 'Bel Air Elemmentary 3'
            }, {
              name: 'Managed By',
              value: 'Some Dude 3'
            }, {
              name: 'Address',
              value: '380 New York St 3'
            }, {
              name: 'City',
              value: 'Redlands 3'
            }]
          }],
          unMatchedFeatures: [{
            label: 'Bel Air Elemmentary 1',
            fieldInfo: [{
              name: 'Factility Name',
              value: 'Bel Air Elemmentary 1'
            }, {
              name: 'Managed By',
              value: 'Some Dude 1'
            }, {
              name: 'Address',
              value: '380 New York St 1'
            }, {
              name: 'City',
              value: 'Redlands 1'
            }]
          }, {
            label: 'Bel Air Elemmentary 2',
            fieldInfo: [{
              name: 'Factility Name',
              value: 'Bel Air Elemmentary 2'
            }, {
              name: 'Managed By',
              value: 'Some Dude 2'
            }, {
              name: 'Address',
              value: '380 New York St 2'
            }, {
              name: 'City',
              value: 'Redlands 2'
            }]
          }],
          duplicateFeatures: [{
            label: 'Bel Air Elemmentary 1',
            fieldInfo: [{
              name: 'Factility Name',
              value: 'Bel Air Elemmentary 1',
              duplicateFieldInfo: {
                value: 'Bel Air Elemmentary 1 duplicate'
              }
            }, {
              name: 'Managed By',
              value: 'Some Dude 1',
              duplicateFieldInfo: {
                value: 'Some Dude 1 duplicate'
              }
            }, {
              name: 'Address',
              value: '380 New York St 1',
              duplicateFieldInfo: {
                value: '380 New York St 1 duplicate'
              }
            }, {
              name: 'City',
              value: 'Redlands 1',
              duplicateFieldInfo: {
                value: 'Redlands 1 duplicate'
              }
            }]
          }]
        };
      },

      _addResultView: function (locateResults) {
        var r = new Review({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          matchedList: locateResults.matchedFeatures,
          unMatchedList: locateResults.unMatchedFeatures,
          duplicateList: locateResults.duplicateFeatures,
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });
        this.pageContainer.addView(r);
      }
    });
  });