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
  'dojo/_base/html',
  'dojo/topic',
  'dojo/Evented',
  'dojo/query',
  'dojo/dom-class',
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  "dojo/text!./templates/PageContainer.html",
  'jimu/dijit/ViewStack'
],
  function (declare,
    lang,
    array,
    html,
    topic,
    Evented,
    query,
    domClass,
    _WidgetBase,
    _TemplatedMixin,
    template,
    ViewStack) {
    return declare([_WidgetBase, _TemplatedMixin, Evented], {
      templateString: template,
      selected: '',
      tabs: null,
      average: false,
      nls: null,

      'baseClass': 'jimu-tab3',
      declaredClass: 'PageContainer', //TODO need to seperate from this

      //TODO need to update this to disable home when when currentIndex === altHomeIndex
      //TODO Previn asked about supporting a breadcrumb

      views: [],
      _currentIndex: -1,
      _homeIndex: 0,
      _rootIndex: 0,
      theme: '',
      isDarkTheme: '',
      styleColor: '',
      altHomeIndex: 0,
      nextDisabled: false,


      //requires an instance of the appConfig
      //using altHomeIndex allows the user to set an alternate home view depending upon where we are in a workflow

      //views must implement a property called label that will uniquely identify the view
      //views can implement a deferred validate function that will be called prior to actually selecting the view
      //views can implement an altNextIndex or altBackIndex when a given view can navigate to one or more child views


      //public methods:
      //selectView
      //getSelectedIndex
      //getViewByIndex
      //getViewByTitle
      //addView
      //addViewAtIndex
      //removeViewByTitle
      //removeView
      //removeViewByIndex

      //events:
      //view-changed
      //view-added
      //view-removed
      //theme-change
      //layout-change
      //style-change
      //widget-change
      //map-change

      //css classes:
      //control-node
      //control-table
      //container-node
      //tab-shelter
      //page-item-td-left
      //page-item-td-right
      //page-item-div
      //main-text
      //margin-right-5
      //margin-left-5
      //float-right
      //float-left
      //bg-back-img
      //bg-back-img-white
      //bg-home
      //bg-home-img
      //bg-home-img-white
      //bg-next-img
      //bg-next-img-white
      //bg-img


      //Use this when jimu dijit
      //postMixInProperties: function () {
      //  this.nls = window.jimuNls.pageContainer;
      //},
      //get nls from here for now
      constructor: function (options) {
        lang.mixin(this, options);

        //get the theme from appConfig so we can handle black/white image toggle
        this.theme = this.appConfig.theme.name;

        //subscribe to appConfigChange to know when to update local resources like images
        this.own(topic.subscribe("appConfigChanged", lang.hitch(this, this._onAppConfigChanged)));

        this.own(topic.subscribe("builder/styleChanged", lang.hitch(this, this._onBuilderStyleChanged)));
      },

      postCreate: function () {
        this.inherited(arguments);

        if (!this.displayControllerOnStart) {
          this.toggleController(true);
        }

        //use white images when in these themes...need a way to check if Dashboard is in light theme
        this._darkThemes = ['DartTheme', 'DashboardTheme'];
        this.updateImageNodes();
      },

      startup: function () {
        this.inherited(arguments);
        this._started = true;

        this._initSelf();
        if (this.selected) {
          this.selectView(this.selected);
        } else if (this.views.length > 0) {
          this.selectView(this._homeIndex);
        }
      },

      _onBuilderStyleChanged: function (styleChange) {
        this.setStyleColor(styleChange.styleColor);

      },

      _onAppConfigChanged: function (appConfig, reason, changedData) {
        switch (reason) {
          case 'themeChange':
            this.theme = appConfig.theme.name;
            this.updateImageNodes();
            this._updateViewTheme();
            this.emit('theme-change', appConfig, reason, changedData);
            break;
          case 'layoutChange':
            this.emit('layout-change', appConfig, reason, changedData);
            break;
          case 'styleChange':
            this.emit('style-change', appConfig, reason, changedData);
            break;
          case 'widgetChange':
            this.emit('widget-change', appConfig, reason, changedData);
            break;
          case 'mapChange':
            this.emit('map-change', appConfig, reason, changedData);
            break;
        }
      },

      selectView: function (index) {
        this.viewStack.switchView(index);
        this._updateDomNodes(index);
        this._currentIndex = index;
        this.emit('view-changed', index);
      },

      showShelter: function () {
        html.setStyle(this.shelter, 'display', 'block');
      },

      hideShelter: function () {
        html.setStyle(this.shelter, 'display', 'none');
      },

      _initSelf: function () {
        if (!this.viewStack) {
          this.viewStack = new ViewStack(null, this.containerNode);
        } else {
          this.viewStack._currentView = undefined;
        }
        this._initViews();
      },

      _initViews: function () {
        array.forEach(this.views, lang.hitch(this, function (v) {
          this.addView(v);
        }));
      },

      _prevView: function () {
        this._navView(false);
      },

      _homeView: function () {
        this.selectView(this.altHomeIndex !== this._homeIndex ? this.altHomeIndex : this._homeIndex);
      },

      _nextView: function () {
        this._navView(true);
      },

      _navView: function (isNext) {
        //this function will first check the current page for an altBackIndex
        // if found it will navigate to that index otherwise it will decrement the index by one and navigate
        //altBackIndex allows the controller to navigate to the appropriate page when the appropriate "back" page
        // is not based simply on the previous view in the list but rather some setting the user has defined
        var title = this.getSelectedTitle();
        var currentView = this.getViewByTitle(title);

        var emitText = isNext ? 'next-view' : 'back-view';
        var navIndex = isNext ? currentView.altNextIndex : currentView.altBackIndex;

        var view;
        //if altNextIndex or altBackIndex is defined default to those
        // otherwise move in a forward or backward direction from the current index
        if (typeof (navIndex) !== 'undefined') {
          view = this.getViewByIndex(navIndex);
        } else {
          if (isNext) {
            if (this._currentIndex < this.viewCount - 1) {
              this._currentIndex += 1;
              view = this.getViewByIndex(this._currentIndex);
            }
          } else {
            if ((this._currentIndex - 1) <= this._homeIndex) {
              view = this.getViewByIndex(this._homeIndex);
            } else {
              this._currentIndex -= 1;
              view = this.getViewByIndex(this._currentIndex);
            }
          }
        }
        if (view) {
          var viewResults = { currentView: currentView, navView: view };
          this.emit(emitText, viewResults);

          //TODO think through this logic some more...goal is to have a spot to respond to back and next up front rather than
          // after the event has been fired
          //The validate function would return true or false if the navigation is supported or if we need to do something like
          // ask a question...use case that is driving this is needing to ask if they want to clear the settings that have defined
          // to this point when they navigate back to the start page...when we respond to the event emitted it is too late as we already see the next page before they
          // provide the response...yes or no
          if (currentView.validate) {
            currentView.validate(emitText, viewResults).then(lang.hitch(this, function (v) {
              if (v) {
                this.selectView(view.index);
              }
            }));
          }else {
            this.selectView(view.index);
          }
        }
      },

      getSelectedIndex: function () {
        return this._currentIndex;
      },

      getSelectedTitle: function () {
        return this.viewStack.getSelectedLabel();
      },

      getViewByIndex: function (idx) {
        if (this.views.length > idx) {
          return this.views[idx];
        }
      },

      getViewByTitle: function (title) {
        for (var i = 0; i < this.views.length; i++) {
          var view = this.views[i];
          if (view.label === title) {
            return view;
          }
        }
        return;
      },

      _updateControl: function (node, disable) {
        if (disable) {
          html.addClass(node, 'control-disbaled');
        } else {
          html.removeClass(node, 'control-disbaled');
        }
      },

      _updateViews: function () {
        //make sure the view index and count is current when add/remove view from stack
        this.viewCount = this.views.length;
        for (var i = 0; i < this.views.length; i++) {
          var view = this.views[i];
          view.styleColor = this.styleColor;
          view.index = i;
        }
      },

      addView: function (view) {
        //adds a new view to the viewstack
        view.pageContainer = this;
        if (!this._containsView(view.label)) {
          this.views.push(view);
        }
        this.viewStack.addView(view);
        this._updateViews();
        this.selectView(this._currentIndex);
        this.emit('view-added', view);
      },

      addViewAtIndex: function (view) {
        ////adds a new view to the viewstack at the user defined index
        //this.viewStack.addView(view);
        this.emit('view-added', view);
        this._updateViews();
      },

      removeViewByTitle: function (title) {
        var view = this.getViewByTitle(title);
        this.removeViewByIndex(view.index);
      },

      removeView: function (view) {
        this.removeViewByIndex(view.index);
      },

      removeViewByIndex: function (idx) {
        var view = this.getViewByIndex(idx);
        this.viewStack.removeView(view);
        this.views.splice(idx, 1);
        this._updateViews();
        if (idx < this.views.length) {
          this.selectView(idx);
        } else if(typeof(this.altHomeIndex) !== 'undefined'){
          this.selectView(this.altHomeIndex);
        } else {
          //TODO think through this more...
          // if a view is removed and we don't have a next view where should it go?
          this.selectView(this.homeIndex);
        }
        this.emit('view-removed', view);
      },

      _clearViews: function () {
        array.forEach(this.views, lang.hitch(this, function (v) {
          this.viewStack.removeView(v);
        }));
        this.views = [];
      },

      _containsView: function (title) {
        for (var i = 0; i < this.views.length; i++) {
          var view = this.views[i];
          if (view.label === title) {
            return true;
          }
        }
        return false;
      },

      setStyleColor: function (styleColor) {
        this.styleColor = styleColor;
        array.forEach(this.views, lang.hitch(this, function (view) {
          view.styleColor = styleColor;
        }));
      },

      updateImageNodes: function () {
        //toggle white/black images
        var isDark = this._darkThemes.indexOf(this.theme) > -1;
        this._updateImageNode(isDark, 'bg-back-img', 'bg-back-img-white');
        this._updateImageNode(isDark, 'bg-home-img', 'bg-home-img-white');
        this._updateImageNode(isDark, 'bg-next-img', 'bg-next-img-white');
      },

      _updateDomNodes: function (index) {
        var homeIndex = this._homeIndex !== this.altHomeIndex ? this.altHomeIndex : this._homeIndex;

        var backDisabled = index === this._homeIndex ? true : index + 1 === this.views.length ? false : false;
        this._updateControl(this.backTd, backDisabled);
        this._updateControl(this.backImage, backDisabled);

        var homeDisabled = index === homeIndex ? true : index + 1 === this.views.length ? false : false;
        this._updateControl(this.homeTd, homeDisabled);
        this._updateControl(this.homeImage, homeDisabled);

        //nextDisabled is so a view can flag it to prevent navigation until the user does something or force it
        // to be enabled if view supports an altNextIndex that would allow it to not just go to next view in the stack
        var finalViewHasAltIndex = typeof(this.views[this.views.length - 1].altNextIndex) !== 'undefined';
        var nextDisabled = this.nextDisabled ? this.nextDisabled : (index === homeIndex) && !this.nextDisabled ?
          false : ((index + 1 === this.views.length) && !finalViewHasAltIndex) ? true : this.nextDisabled;

        //var nextDisabled = (index === homeIndex) ? false : index + 1 === this.views.length ? true : false;
        this._updateControl(this.nextTd, nextDisabled);
        this._updateControl(this.nextImage, nextDisabled);
      },

      _updateImageNode: function (isDark, img, imgWhite) {
        var removeClass = isDark ? img : imgWhite;
        var addClass = isDark ? imgWhite : img;
        var imageNodes = query('.' + removeClass, this.domNode);
        array.forEach(imageNodes, function (node) {
          domClass.remove(node, removeClass);
          domClass.add(node, addClass);
        });
      },

      _updateViewTheme: function (theme) {
        this.theme = theme;
        array.forEach(this.views, lang.hitch(this, function (view) {
          view.theme = theme;
        }));
      },

      toggleController: function (isDisabled) {
        if (this.controlTable) {
          if (isDisabled) {
            if (!domClass.contains(this.controlTable, 'display-none')) {
              domClass.add(this.controlTable, 'display-none');
            }
          } else {
            if (domClass.contains(this.controlTable, 'display-none')) {
              domClass.remove(this.controlTable, 'display-none');
            }
          }
        }
      }
    });
  });