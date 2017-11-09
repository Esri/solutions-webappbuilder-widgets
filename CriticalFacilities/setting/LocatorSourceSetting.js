///////////////////////////////////////////////////////////////////////////
// Copyright © 2015 Esri. All Rights Reserved.
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
define(
  ["dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/html",
    "dojo/on",
    "dojo/Evented",
    "dojo/Deferred",
    'dojo/query',
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "jimu/portalUrlUtils",
    "jimu/dijit/Message",
    "jimu/dijit/_GeocodeServiceChooserContent",
    "jimu/dijit/Popup",
    "jimu/dijit/LoadingShelter",
    "esri/request",
    "esri/lang",
    './LookupList',
    './EditFields',
    "jimu/utils",
    "dojo/text!./LocatorSourceSetting.html",
    "jimu/dijit/CheckBox",
    "dijit/form/ValidationTextBox",
    "dijit/form/NumberTextBox"
  ],
  function(
    declare,
    lang,
    html,
    on,
    Evented,
    Deferred,
    query,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    portalUrlUtils,
    Message,
    _GeocodeServiceChooserContent,
    Popup,
    LoadingShelter,
    esriRequest,
    esriLang,
    LookupList,
    EditFields,
    jimuUtils,
    template,
    CheckBox) {
    /*jshint maxlen:150*/
    return declare([
      _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented
    ], {
      baseClass: "jimu-widget-search-locator-source-setting",
      tr: null,
      nls: null,
      config: null,
      singleLineFieldName: null,
      templateString: template,

      _locatorDefinition: null,
      _esriLocatorRegExp: /http(s)?:\/\/geocode(.){0,3}\.arcgis.com\/arcgis\/rest\/services\/World\/GeocodeServer/g,
      serviceChooserContent: null,
      geocoderPopup: null,
      addressFields: null,

      _clickSet: false,

      postCreate: function() {
        this.inherited(arguments);
        this.exampleHint = this.nls.locatorExample +
          ": http://&lt;myServerName&gt;/arcgis/rest/services/World/GeocodeServer";

        this.singleEnabled = true;
        this.multiEnabled = true;

        //this.enableSingleField = this._initCheckBox(this.enableSingleField, this.nls.enableSingleField, this.editSingleFields);
        //this.enableMultiField = this._initCheckBox(this.enableMultiField, this.nls.enableMultiField, this.editMultiFields);
       
        this.own(on(this.editSingleFields, 'click', lang.hitch(this, this._editFields, 'single')));
        this.own(on(this.editMultiFields, 'click', lang.hitch(this, this._editFields, 'multi')));

        this._setMessageNodeContent(this.exampleHint);

        this.config = this.config ? this.config : {};
        this.setConfig(this.config);
      },

      //_initCheckBox: function (domNode, nlsValue, editNode) {
      //  domNode = new CheckBox({
      //    checked: false,
      //    label: nlsValue
      //  }, domNode);
      //  this._toggleNode(editNode, false);
      //  this.own(on(domNode, 'change', lang.hitch(this, function () {
      //    var enabled = domNode.getValue();
      //    switch (domNode.label) {
      //      case this.nls.enableSingleField:
      //        this.singleEnabled = enabled;
      //        break;
      //      case this.nls.enableMultiField:
      //        this.multiEnabled = enabled;
      //        break;
      //    }
      //    this._toggleNode(editNode, enabled);
      //  })));
      //  return domNode;
      //},

      setRelatedTr: function(tr) {
        this.tr = tr;
      },

      getRelatedTr: function() {
        return this.tr;
      },

      setDefinition: function(definition) {
        this._locatorDefinition = definition || {};
      },

      getDefinition: function() {
        return this._locatorDefinition;
      },

      setConfig: function(config) {
        if (Object.prototype.toString.call(config) !== "[object Object]") {
          return;
        }

        var url = config.url;
        if (!url) {
          return;
        }
        this.config = config;

        if (typeof (this.config.singleEnabled) !== 'undefined') {
          this.singleEnabled = this.config.singleEnabled;
          //this.enableSingleField.setValue(this.config.singleEnabled);
        }
        if (typeof (this.config.multiEnabled) !== 'undefined') {
          this.multiEnabled = this.config.multiEnabled;
          //this.enableMultiField.setValue(this.config.multiEnabled);
        }

        //this.shelter.show();
        if (this._locatorDefinition.url !== url) {
          this._getDefinitionFromRemote(url).then(lang.hitch(this, function(response) {
            if (url && (response && response.type !== 'error')) {
              this._locatorDefinition = response;
              this._locatorDefinition.url = url;
              this._setSourceItems();
              this._setAddressFields(url, this.config);//un-comm
              this._setMessageNodeContent(this.exampleHint);
            } else if (url && (response && response.type === 'error')) {
              this._setSourceItems();
              this._disableSourceItems();
              this._setMessageNodeContent(esriLang.substitute({
                'URL': response.url
              }, lang.clone(this.nls.invalidUrlTip)), true);
            }
            //this.shelter.hide();
          }));
        } else {
          this._setSourceItems();
          //this._setAddressFields(url);
          this._setMessageNodeContent(this.exampleHint);
          this.shelter.hide();
        }
      },

      isValidConfig: function () {
        //TODO this needs some updating 
        var config = this.getConfig();
        if (config.url && config.name && config.singleLineFieldName) {
          return true;
        } else {
          return false;
        }
      },

      showValidationTip: function() {
        this._showValidationErrorTip(this.locatorUrl);
        this._showValidationErrorTip(this.locatorName);
      },

      getConfig: function() {
        return {
          url: this.locatorUrl.get('value'),
          name: jimuUtils.stripHTML(this.locatorName.get('value')),
          singleEnabled: this.singleEnabled,
          multiEnabled: this.multiEnabled,
          singleLineFieldName: this.singleLineFieldName,
          addressFields: this.addressFields,
          singleAddressFields: this.singleAddressFields,
          countryCode: jimuUtils.stripHTML(this.countryCode.get('value')),
          minCandidateScore: jimuUtils.stripHTML(this.minCandidateScore.get('value')),
          type: "locator"
        };
      },

      _editFields: function(type){
        switch (type) {
          case 'single':
            if (this.singleEnabled) {
              this._editSingleAddressFieldsTableValues(this.singleAddressFields);
            }
            break;
          case 'multi':
            if (this.multiEnabled) {
              this._editMultiAddressFieldsTableValues();
            }
            break;
        }
      },

      _editSingleAddressFieldsTableValues: function (fields) {
        if (this.singleLineField) {
          var editFields = new EditFields({
            nls: this.nls,
            type: 'locatorFields',
            addressFields: fields || [this.singleLineField],
            popupTitle: this.nls.configureSingleFields,
            disableDisplayOption: true
          });
          this.own(on(editFields, 'edit-fields-popup-ok', lang.hitch(this, function () {
            this.singleAddressFields = editFields.fieldInfos;
          })));
          editFields.popupEditPage();
        }
      },

      _editMultiAddressFieldsTableValues: function () {
        var editFields = new EditFields({
          nls: this.nls,
          type: 'locatorFields',
          addressFields: this.addressFields,
          popupTitle: this.nls.configureMultiFields,
          disableDisplayOption: false
        });
        this.own(on(editFields, 'edit-fields-popup-ok', lang.hitch(this, function () {
          this.addressFields = editFields.fieldInfos;
        })));
        editFields.popupEditPage();
      },

      _onLocatorNameBlur: function() {
        this.locatorName.set('value', jimuUtils.stripHTML(this.locatorName.get('value')));
      },

      _onCountryCodeBlur: function() {
        this.countryCode.set('value', jimuUtils.stripHTML(this.countryCode.get('value')));
      },

      _onMinCandidateScoreBlur: function () {
        this.minCandidateScore.set('value', jimuUtils.stripHTML(this.minCandidateScore.get('value')));
      },

      _disableSourceItems: function() {
        this.locatorName.set('disabled', true);
        this.countryCode.set('disabled', true);
        this.minCandidateScore.set('disabled', true);
        //this.enableSingleField.set('disabled', true);
        //this.enableMultiField.set('disabled', true);
      },

      _enableSourceItems: function() {
        this.locatorName.set('disabled', false);
        this.countryCode.set('disabled', false);
        this.minCandidateScore.set('disabled', false);
        //this.enableSingleField.set('disabled', false);
        //this.enableMultiField.set('disabled', false);
      },

      _setSourceItems: function() {
        var config = this.config;
        if (config.url) {
          // this.validService = true;
          this.locatorUrl.set('value', config.url);
          this._processCountryCodeRow(config.url);
          this._processMinCandidateScoreRow(config.url);  //??   
          this._setAddressFields(config.url, this.config);
        }
        if (config.name) {
          this.locatorName.set('value', jimuUtils.stripHTML(config.name));
        }
        if (config.singleLineFieldName) {
          this.singleLineFieldName = config.singleLineFieldName;
        }
        if (config.countryCode) {
          this.countryCode.set('value', jimuUtils.stripHTML(config.countryCode));
        }
        if (config.minCandidateScore) {
          this.minCandidateScore.set('value', jimuUtils.stripHTML(config.minCandidateScore));
        }
        this._enableSourceItems();
        
      },

      _setAddressFields: function (url, config) {
        if (!(url) && !config) {
          return;
        }
        if (config && config.addressFields && config.singleAddressFields) {
          this.addressFields = config.addressFields;
          this.singleLineFieldName = config.singleLineFieldName;
          this.singleLineField = config.singleAddressFields[0];//TODO get rid of this
          this.singleAddressFields = config.singleAddressFields;
        } else {
          esriRequest({
            url: url,
            content: {
              f: 'json'
            },
            handleAs: 'json',
            callbackParamName: 'callback'
          }).then(lang.hitch(this, function (response) {
            if (response && response.addressFields) {
              this.addressFields = response.addressFields;
            }

            if (response && response.singleLineAddressField && response.singleLineAddressField.name) {
              this.singleLineFieldName = response.singleLineAddressField.name;
              this.singleLineField = response.singleLineAddressField;//TODO get rid of this
              this.singleAddressFields = [response.singleLineAddressField];
            }
          }), lang.hitch(this, function (err) {
            console.error(err);
          }));
        }
      },

      _isEsriLocator: function(url) {
        this._esriLocatorRegExp.lastIndex = 0;
        return this._esriLocatorRegExp.test(url);
      },

      _getDefinitionFromRemote: function(url) {
        var resultDef = new Deferred();
        if (this._isEsriLocator(url)) {
          // optimize time
          resultDef.resolve({
            singleLineAddressField: {
              name: "SingleLine",
              fieldName: "SingleLine",
              type: "esriFieldTypeString",
              alias: "Single Line Input",
              label: "Single Line Input",
              required: false,
              length: 200,
              localizedNames: {},
              recognizedNames: {}
            },
            capabilities: "Geocode,ReverseGeocode,Suggest"
          });
        } else {
          var def = esriRequest({
            url: url,
            content: {
              f: 'json'
            },
            handleAs: 'json',
            callbackParamName: 'callback'
          });
          this.own(def);
          def.then(lang.hitch(this, function(response) {
            resultDef.resolve(response);
          }), lang.hitch(this, function(err) {
            console.error(err);
            resultDef.resolve({
              type: 'error',
              url: this._getRequestUrl(url)
            });
          }));
        }

        return resultDef.promise;
      },

      _setMessageNodeContent: function(content, err) {
        html.empty(this.messageNode);
        if (!content.nodeType) {
          content = html.toDom(content);
        }
        html.place(content, this.messageNode);
        if (err) {
          html.addClass(this.messageNode, 'error-message');
        } else {
          html.removeClass(this.messageNode, 'error-message');
        }
      },

      _getRequestUrl: function(url) {
        var protocol = window.location.protocol;
        if (protocol === 'http:') {
          return portalUrlUtils.setHttpProtocol(url);
        } else if (protocol === 'https:'){
          return portalUrlUtils.setHttpsProtocol(url);
        } else {
          return url;
        }
      },

      _onSetLocatorUrlClick: function() {
        this._clickSet = true;
        this._openServiceChooser();
      },

      _openLocatorChooser: function() {
        this._clickSet = false;
        this._openServiceChooser();
      },

      _openServiceChooser: function() {
        this.serviceChooserContent = new _GeocodeServiceChooserContent({
          url: this.locatorUrl.get('value') || ""
        });
        this.shelter = new LoadingShelter({
          hidden: true
        });

        this.geocoderPopup = new Popup({
          titleLabel: this.nls.setGeocoderURL,
          autoHeight: true,
          content: this.serviceChooserContent.domNode,
          container: window.jimuConfig.layoutId,
          width: 640
        });
        this.shelter.placeAt(this.geocoderPopup.domNode);
        html.setStyle(this.serviceChooserContent.domNode, 'width', '580px');
        html.addClass(
          this.serviceChooserContent.domNode,
          'override-geocode-service-chooser-content'
        );

        this.serviceChooserContent.own(
          on(this.serviceChooserContent, 'validate-click', lang.hitch(this, function() {
            html.removeClass(
              this.serviceChooserContent.domNode,
              'override-geocode-service-chooser-content'
            );
          }))
        );
        this.serviceChooserContent.own(
          on(this.serviceChooserContent, 'ok', lang.hitch(this, '_onSelectLocatorUrlOk'))
        );
        this.serviceChooserContent.own(
          on(this.serviceChooserContent, 'cancel', lang.hitch(this, '_onSelectLocatorUrlCancel'))
        );
      },

      _onSelectLocatorUrlOk: function(evt) {
        if (!(evt && evt[0] && evt[0].url && this.domNode)) {
          return;
        }
        this.shelter.show();
        var url = evt[0].url;
        esriRequest({
          url: url,
          content: {
            f: 'json'
          },
          handleAs: 'json',
          callbackParamName: 'callback'
        }).then(lang.hitch(this, function(response) {
          this.shelter.hide();
          if (response &&
            response.singleLineAddressField &&
            response.singleLineAddressField.name) {

            this._enableSourceItems();
            this.locatorUrl.set('value', url);
            if (!this.locatorName.get('value')) {
              if (typeof url !== "string") {
                return "geocoder";
              }
              var strs = url.split('/');
              this.locatorName.set('value', strs[strs.length - 2] || "geocoder");
            }

            this.singleLineFieldName = response.singleLineAddressField.name;
            this.singleLineField = response.singleLineAddressField;

            this._processCountryCodeRow(url);
            this._processMinCandidateScoreRow(url);

            this._locatorDefinition = response;
            this._locatorDefinition.url = url;
            this._setAddressFields(url, this.config);
            if (this._clickSet) {
              this.emit('reselect-locator-url-ok', this.getConfig());
            } else {
              this.emit('select-locator-url-ok', this.getConfig());
            }
            if (this.geocoderPopup) {
              this.geocoderPopup.close();
              this.geocoderPopup = null;
            }

            this._setMessageNodeContent(this.exampleHint);
          } else {
            new Message({
              'message': this.nls.locatorWarning
            });
          }
        }), lang.hitch(this, function(err) {
          console.error(err);
          this.shelter.hide();
          new Message({
            'message': esriLang.substitute({
                'URL': this._getRequestUrl(url)
              }, lang.clone(this.nls.invalidUrlTip))
          });
        }));
      },

      _onSelectLocatorUrlCancel: function() {
        if (this.geocoderPopup) {
          this.geocoderPopup.close();
          this.geocoderPopup = null;

          this.emit('select-locator-url-cancel');
        }
      },

      _toggleNode: function (domNode, enable) {
        if (domNode) {
          html.removeClass(domNode, enable ? 'edit-fields-disabled' : 'edit-fields');
          html.addClass(domNode, enable ? 'edit-fields' : 'edit-fields-disabled');
        }
      },

      _processCountryCodeRow: function(url) {
        if (this._isEsriLocator(url)) {
          this.countryCode.set('value', "");
          html.removeClass(this.countryCodeRow, 'hide-country-code-row');
        } else {
          html.addClass(this.countryCodeRow, 'hide-country-code-row');
        }
      },

      _processMinCandidateScoreRow: function(url) {
        if (this._isEsriLocator(url)) {
          this.minCandidateScore.set('value', "");
          html.removeClass(this.minCandidateScoreRow, 'hide-country-code-row');
        } else {
          html.addClass(this.minCandidateScoreRow, 'hide-country-code-row');
        }
      },

      _showValidationErrorTip: function(_dijit) {
        if (!_dijit.validate() && _dijit.domNode) {
          if (_dijit.focusNode) {
            var _disabled = _dijit.get('disabled');
            if (_disabled) {
              _dijit.set('disabled', false);
            }
            _dijit.focusNode.focus();
            setTimeout(lang.hitch(this, function() {
              _dijit.focusNode.blur();
              if (_disabled) {
                _dijit.set('disabled', true);
              }
              _dijit = null;
            }), 100);
          }
        }
      }
    });
  });