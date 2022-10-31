@0xc4d1311aba086738;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("dataSourceCollection");

using DataSource = import "dataSource.capnp".DataSource;

struct DataSourceCollection {
  dataSources @0 :List(DataSource);
}

