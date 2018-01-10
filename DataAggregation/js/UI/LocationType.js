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
  'dijit/_WidgetBase',
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin",
  "dojo/Evented",
  "dojo/text!./templates/LocationType.html",
  'dijit/form/RadioButton'
],
  function (declare,
    lang,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Evented,
    template) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
      baseClass: 'cf-location-type',
      declaredClass: 'CriticalFacilities.LocationType',
      templateString: template,
      _started: null,
      label: 'LocationType',
      parent: null,
      nls: null,
      map: null,
      appConfig: null,
      config: null,
      useAddress: true,
      useCoordinates: false,
      theme: '',
      isDarkTheme: '',
      styleColor: '',
      _coordinatesView: undefined,
      _addressView: undefined,

      constructor: function (options) {
        lang.mixin(this, options);
      },

      postCreate: function () {
        this.inherited(arguments);
        this.rdoAddress.set('checked', this.useAddress);
        this.rdoCoordinates.set('checked', this.useCoordinates);
      },

      startup: function () {
        this._started = true;
        this._updateAltIndexes();
      },

      onShown: function () {
      },

      _updateAltIndexes: function () {
        //No gaurentee that page container will exist prior to when the view is created
        // However, it must exist for the page to be shown
        if (this.pageContainer && !this._coordinatesView && !this._addressView) {
          this._coordinatesView = this.pageContainer.getViewByTitle('Coordinates');
          this._addressView = this.pageContainer.getViewByTitle('Addresses');

          var isUseAddress = this.rdoAddress.checked;
          if (this._addressView && this._coordinatesView) {
            //when navigating back from either of these views we need to go back to this LocationType view
            this._addressView.altBackIndex = this.index;
            this._coordinatesView.altBackIndex = this.index;
            this.altNextIndex = isUseAddress ? this._addressView.index : this._coordinatesView.index;
          }
        }
      },

      _rdoAddressClick: function () {
        this.rdoAddress.set('checked', true);
      },

      _rdoAddressChanged: function (v) {
        this.useAddress = v;
        //altNextIndex should be set to address view when true
        if (this._addressView && this._coordinatesView) {
          this.altNextIndex = v ? this._addressView.index : this._coordinatesView.index;
        }
        this.parent._locationMappingComplete = false;
      },

      _rdoCoordinateClick: function () {
        this.rdoCoordinates.set('checked', true);
      },

      _rdoCoordinateChanged: function (v) {
        this.useCoordinates = v;
        //altNextIndex should be set to coordinates view when true
        if (this._addressView && this._coordinatesView) {
          this.altNextIndex = v ? this._coordinatesView.index : this._addressView.index;
        }
        this.parent._locationMappingComplete = false;
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

      _getResults: function () {
        if (this.useAddress) {
          return this._addressView._getResults();
        } else {
          return this._coordinatesView._getResults();
        }
      }

    });
  });