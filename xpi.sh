#! /bin/bash

makexpi(){
 version=$1
  zip -r "otrswatcher-$1.xpi" install.rdf chrome/ chrome.manifest defaults/
}

version=$(<install.rdf sed -n "/<em:version>/! b; s|<em:version>\(.*\)</em:version>|\1| p")
makexpi $version
