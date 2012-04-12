  // TODO: set this up correctly
  var map, marker, circle;
  var locale = "san francisco"; // our current parcel set
  var maps = {
    'san francisco': {
      'json': 'http://a.tiles.mapbox.com/v3/matth.sf-parcels.jsonp',
      'interaction': 'setFormParcelSF' // Name of the function that gets parcel info
    },
    'detroit': {
      'json': 'http://a.tiles.mapbox.com/v3/matth.det-parcels2.jsonp',
      'interaction': 'setFormParcelDET'
    }
  }
  
  $.fn.clearForm = function() {
    return this.each(function() {
      var type = this.type, tag = this.tagName.toLowerCase();
      if (tag == 'form')
        return $(':input',this).clearForm();
      if (type == 'text' || type == 'password' || tag == 'textarea')
        this.value = '';
      else if (type == 'checkbox' || type == 'radio')
        this.checked = false;
      else if (tag == 'select')
        this.selectedIndex = -1;
    });
  };
  
  // Update the hidden parcel_id field to matcht the parcel the user
  // has selected
  function setFormParcelSF(id) {
    // Get the block+lot from the interaction data. 
    // Later on, this will need to be a variable / paramaterized; or 
    // standardized per base layer dataset.
    var blocklot = id.data.BLKLOT;
    var human_readable_location = id.data.FROM_ST;
    if (id.data.FROM_ST != id.data.TO_ST) {
      human_readable_location += "-" + id.data.TO_ST;
    };
    human_readable_location += " " + id.data.STREET + " " + id.data.ST_TYPE;
    
    $('#parcel_id').val(blocklot);
    $('h2 .parcel_id').text(human_readable_location);
    
    console.log(id.data);
  }
  
  wax.tilejson('http://a.tiles.mapbox.com/v3/matth.sf-parcels.jsonp',
    function(tilejson) {
      map = new L.Map('map-div');
      map.addLayer(new wax.leaf.connector(tilejson));
      wax.leaf.interaction()
        .map(map)
        .tilejson(tilejson)
        .on('on', function(o) {
            // console.log(o.e.type);
            if (o.e.type == 'mouseup') { // was mousemove
                console.log(o.formatter({format:'full'}, o.data));
                setFormParcelSF(o);
                marker.setLatLng(map.mouseEventToLatLng(o.e));
                map.removeLayer(circle)
                if(!$('#form').is(":visible")) {
                    $('#startpoint').slideToggle();
                    $('#form').slideToggle();
                }
               // // create a marker in the given location and add it to the map
                var marker = new L.Marker(map.mouseEventToLatLng(o.e));
                map.addLayer(marker);
               //
               // // attach a given HTML content to the marker and immediately open it
               // marker.bindPopup(o.formatter({ format: 'teaser' }, o.data)).openPopup();
            }
        });
      
  		map.on('locationfound', onLocationFound);
  		map.on('locationerror', onLocationError);

  		map.locateAndSetView(18);
  		// For Detroit testing: 
  		// var detroit = new L.LatLng(42.342781, -83.084793);
  		// map.setView(detroit, 18);
      
  		function onLocationFound(e) {
		    marker = new L.Marker(e.latlng);
			  map.addLayer(marker);

  			var radius = e.accuracy / 2;
  			circle = new L.Circle(e.latlng, radius);
  			map.addLayer(circle);
  		}

  		function onLocationError(e) {
  			alert(e.message);
  		}
  });
  
  $(document).ready(function(){
      /* attach a submit handler to the form */
      $("#parcelform").submit(function(event) {
        /* stop form from submitting normally */
        event.preventDefault(); 

        $('#parcelform').clearForm();
        /* get some values from elements on the page: */
        var $form = $( this ),
            parcel_id = $form.find( 'input[name="parcel_id"]' ).val(),
            num_buildings = $form.find( 'input[name="num-buildings"]' ).val(),
            property_use = $form.find( 'input[name="property-use"]' ).val(),
            vacancy = $form.find( 'input[name="vacancy-1"]' ).val(),
            condition = $form.find( 'input[name="condition-1"]' ).val(),
            url = $form.attr( 'action' );

        /* Send the data using post and put the results in a div */
        $.post( url, 
            { responses: [{ parcels: [{
                parcel_id: parcel_id, 
                responses: {
                    num_buildings: num_buildings,
                    property_use: property_use,
                    vacancy: vacancy,
                    condition: condition,
                }
            }]}]}, //wtf 
            function( data ) {
            
              var content = $( data ).find( '#content' );
              $( "#results" ).empty().append( content );
            }
        );
        
        
    });      
});
  
