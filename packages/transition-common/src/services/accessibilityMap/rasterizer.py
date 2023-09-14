from osgeo import gdal, ogr, osr
import os
import math

resolution_meters = 2
noData_value = 0
is_test = True

# Made to test various GeoJSON files quickly
if is_test:
    test_number = '1'
    input_vector_filename = 'test' + test_number + '.geojson'
    inter_raster_filename = 'raster' + test_number + '.tif'
    output_vector_filename = 'vector' + test_number + '.geojson'
else:
    input_vector_filename = 'input.geojson'
    inter_raster_filename = 'raster.tif'
    output_vector_filename = 'output.geojson'

vector_driver = 'GeoJSON'
raster_driver = 'GTiff'

source_geojson = ogr.GetDriverByName(vector_driver).Open(input_vector_filename)
source_layer = source_geojson.GetLayer()
projection = source_layer.GetSpatialRef()

x_min, x_max, y_min, y_max = source_layer.GetExtent()
y_mid_radians = ((y_max + y_min) / 2) * math.pi / 180

# https://gis.stackexchange.com/questions/75528/understanding-terms-in-length-of-degree-formula/75535#75535
# Coefficients in both below formulae are from the link above
meters_latitude = 111132.92  - 559.82 * math.cos(2 * y_mid_radians) + 1.175 * math.cos(4 * y_mid_radians) - 0.0023 * math.cos(6 * y_mid_radians)
meters_longitude = 111412.84 * math.cos(y_mid_radians) - 93.5 * math.cos(3 * y_mid_radians) + 0.118 * math.cos(5 * y_mid_radians)

x_meters = (x_max - x_min) 
y_meters = (y_max - y_min) 

x_res = int(x_meters * meters_longitude / resolution_meters)
y_res = int(y_meters * meters_latitude / resolution_meters)

inter_file = gdal.GetDriverByName(raster_driver).Create(inter_raster_filename, x_res, y_res, 1, gdal.GDT_Byte, ['NBITS=1'])
inter_file.SetProjection(projection.ExportToWkt())

transform = [x_min, resolution_meters/meters_longitude, 0, y_max, 0, -resolution_meters/meters_latitude]
inter_file.SetGeoTransform(transform)

band = inter_file.GetRasterBand(1)
band.SetNoDataValue(noData_value)

gdal.RasterizeLayer(inter_file, [1], source_layer, burn_values=[128])

# Only way to close a file within GDAL, in order to reopen it as source
inter_file = None

raster_source = gdal.Open(inter_raster_filename)
driver = ogr.GetDriverByName(vector_driver)
vector_dest = driver.CreateDataSource(output_vector_filename)

spatial_ref = osr.SpatialReference()
spatial_ref.ImportFromWkt(raster_source.GetProjectionRef())
dest_layer = vector_dest.CreateLayer('layer', geom_type=ogr.wkbMultiPolygon, srs = spatial_ref)
dest_fieldname = 'DN'
field_def = ogr.FieldDefn(dest_fieldname, ogr.OFTInteger)
dest_layer.CreateField(field_def)
dest_field = noData_value

gdal.Polygonize(raster_source.GetRasterBand(1), raster_source.GetRasterBand(1), dest_layer, dest_field, [], callback=None)

if is_test :
    os.remove(input_vector_filename)
os.remove(inter_raster_filename)

