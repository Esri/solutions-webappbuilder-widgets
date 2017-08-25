# Coordinate-Conversion-Widget

This Coordinate Conversion widget repo has been moved to mature support. Coordinate Conversion widget is now a widget a part of  [Web appBuilder](http://doc.arcgis.com/en/web-appbuilder/) and can be configured in ArcGIS Online without downloading the widget seperatly. However, if you want to host the widget on your own server or customize the widget it is also a part of the Web AppBuilder [(Developer Edition)](https://developers.arcgis.com/web-appbuilder/).


The Coordinate Conversion is an Esri Widget for [Web AppBuilder for ArcGIS](http://doc.arcgis.com/en/web-appbuilder/).The Coordinate Conversion allows analysts to input coordinates, quickly converting them between several common formats including Universal Transverse Mercator (UTM), Military Grid Reference System (MGRS), Degrees, Decimal, Minutes (DDM), Degrees, Minutes, Seconds (DMS), Decimal Degrees (DD), and U.S. National Grid (USNG)).  Analysts also have the ability to interact with the map to dynamically retrieve the current cursor location in any or all of the formats listed above.  They can then use the Coordinate Conversion to easily copy one or all coordinate formats to disseminate information to others for mission critical response.

![Image of Coordinate Conversion Widget][ss]

## Features

* Parses WGS1984 input coordinates and outputs multiple formats of the input coordinate. Output coordinate formats can include:

    * DD, DDM, DMS, MGRS, USNG and UTM

## Sections

* [Requirements](#requirements)
* [Instructions](#instructions)
* [Resources](#resources)
* [Issues](#issues)
* [Contributing](#contributing)
* [Licensing](#licensing)
*

## Requirements

* Web Appbuilder Version 1.2 and above.
* [ArcGIS Web Appbuilder for ArcGIS](http://developers.arcgis.com/web-appbuilder/)

## Instructions
Deploying Widget

Setting Up Repository for Development
In order to develop and test widgets you need to deploy the CoordinateConversion folder to the stemapp/widgets directory in your Web AppBuilder for ArcGIS installation. If you use Github for windows this can be accomplished using the following steps.

1. Sync the repository to your local machine.
2. Open the Repository in Windows Explorer
3. Close Github for Windows
4. Cut and paste the entire CoordinateConversion folder into the stemapp/widgets folder
5. Launch Github for Windows and choose the option to locate the repository. This will change the location on disk to the new location.

## Workflow
The Coordinate Conversion is an intuitive and easy to use widget. Below are some quick How-to steps on performing functions of the Coordinate Conversion.

Convert Coordinate Formats

1.	Click the Coordinate Conversion button.
2.	The Coordinate Conversion window appears.
3.	Enter a coordinate in the Input text box.
4.	Click the (+) button to add an Output coordinate format.
5.	By default, the DD format appears in the Output format.
6.	Using the dropdown, select the desired Output coordinate.
7.	Repeat until all desired Output coordinate formats have been added to the Coordinate Conversion window.
8.	The Input coordinate will automatically be converted in the desired Output coordinate formats.


Zoom-to Input Coordinate

1.	Enter a coordinate in the Input text box.
2.	Click the Zoom button to Zoom-to the specified coordinate location.
3.	An error message will appear if the Input coordinate is invalid.


Map Point Tool

1.	Click the Coordinate Conversion button.
2.	Click directly on the map using the cursor.
3.	A blue point marker will be placed on the map at the clicked location.
4.	The cursor’s coordinate location will automatically be populated in the Input text box.
5.	The Input coordinate will automatically be converted in the desired Output coordinate formats.


Copy Coordinates

1.	Enter a coordinate in the Input text box.
2.	The Input coordinate will automatically be converted in the desired Output coordinate formats.
3.	Click the Copy all output coordinates button in the Input section to copy the Input coordinate in addition to all other Output coordinate formats listed in the Output section.
4.	If only a specific coordinate is desired for copying, click the Copy to clipboard button in the same row as the desired coordinate in the Output section.

Remove Coordinate Output Format

1.	Click the Remove Coordinate button in the Output section in the same row as the desired coordinate.
2.	The Output coordinate will be removed from the Output list.

Coordinate Output Format

The Coordinate Conversion allows formatting of notations using a custom format string for each particular coordinate type.

1.	After a Coordinate is added to the Output list, click the Format Output button.
2.	In the Set Coordinate Format String window, choose the coordinate type to update.
3.	Enter in the custom format string for the desired coordinate type.
      - Click the Add “+/-“ checkbox to append plus or minus signs to the coordinate numbers.
      -	The format string will need to conform to the following rules:
        - DD Decimal Degrees
            - "X" = Longitude
            - "Y" = Latitude
            - "N" or "S" = add "N" or "S" direction based on latitude
            - "E" or "W" = add "E" or "W" direction based on longitude
            - Example: "YE XN = “40.00N 120.00W”
        - MGRS and USNG
            - "Z" = Grid Zone
            - "S" = Grid Segment
            - "X" = Easting
            - "Y" = Northing
            - Example: "Z S X Y" = "19T DE 14639 28236"
        - DMS - Degrees Minutes Seconds
            - "A" = Latitude Degrees
            - "B" = Latitude Minutes
            - "C" = Latitude Seconds
            - "X" = Longitude Degrees
            - "Y" = Longitude Minutes
            - "Z" = Longitude Seconds
            - "N" or "S" = add "N" or "S" direction based on latitude
            - "E" or "W" = add "E" or "W" direction based on longitude
            - Example: "A0° B'N X° Y'E" = "41° 22.12'N 78° 36.45'W"
        - DDM - Decimal Degrees Minutes
            - "A" = Latitude Degrees
            - "B" = Latitude Minutes	  
            - "X" = Longitude Degrees
            - "Y" = Longitude Minutes
            - "N" or "S" = add "N" or "S" direction based on latitude
            - "E" or "W" = add "E" or "W" direction based on longitude
            - Example: "A° B' C"N X° Y' ZE" = "41° 22' 15.1"N 78° 36' 29.2"W"	 
        - UTM
            - "Z" = Zone
            - "H" = Hemisphere
            - "X" = Longitude Band
            - "Y" = Latitude Band
            - Example: "ZH Xm Ym" = "19N 414639m 4428236m"

## General Help

* [New to Github? Get started here.](http://htmlpreview.github.com/?https://github.com/Esri/esri.github.com/blob/master/help/esri-getting-to-know-github.html)

## Resources

* [Web AppBuilder API](https://developers.arcgis.com/web-appbuilder/api-reference/css-framework.htm)
* [ArcGIS API for JavaScript](https://developers.arcgis.com/javascript/)
* [ArcGIS Blog](http://blogs.esri.com/esri/arcgis/)
* [ArcGIS Solutions Website](http://solutions.arcgis.com/military/)
* ![Twitter](https://g.twimg.com/twitter-bird-16x16.png)[@EsriDefense](http://twitter.com/EsriDefense)

## Issues

Find a bug or want to request a new feature?  Please let us know by submitting an [issue](https://github.com/Esri/solutions-webappbuilder-widgets/issues).

## Contributing

Esri welcomes contributions from anyone and everyone. Please see our [guidelines for contributing](https://github.com/esri/contributing).

If you are using [JS Hint](http://http://www.jshint.com/) there is a .jshintrc file included in the root folder which enforces this style.
We allow for 120 characters per line instead of the highly restrictive 80.

## Licensing

Copyright 2015 Esri

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

A copy of the license is available in the repository's [license.txt](license.txt) file.

[ss]: images/screenshot.png
[](Esri Tags: Military Analyst Defense ArcGIS Widget Web AppBuilder ArcGISSolutions)
[](Esri Language: Javascript)