// @generated by the capnpc-rust plugin to the Cap'n Proto schema compiler.
// DO NOT EDIT.
// source: household.capnp


pub mod household {
  #[derive(Copy, Clone)]
  pub struct Owned(());
  impl <'a> ::capnp::traits::Owned<'a> for Owned { type Reader = Reader<'a>; type Builder = Builder<'a>; }
  impl <'a> ::capnp::traits::OwnedStruct<'a> for Owned { type Reader = Reader<'a>; type Builder = Builder<'a>; }
  impl ::capnp::traits::Pipelined for Owned { type Pipeline = Pipeline; }

  #[derive(Clone, Copy)]
  pub struct Reader<'a> { reader: ::capnp::private::layout::StructReader<'a> }

  impl <'a,> ::capnp::traits::HasTypeId for Reader<'a,>  {
    #[inline]
    fn type_id() -> u64 { _private::TYPE_ID }
  }
  impl <'a,> ::capnp::traits::FromStructReader<'a> for Reader<'a,>  {
    fn new(reader: ::capnp::private::layout::StructReader<'a>) -> Reader<'a,> {
      Reader { reader,  }
    }
  }

  impl <'a,> ::capnp::traits::FromPointerReader<'a> for Reader<'a,>  {
    fn get_from_pointer(reader: &::capnp::private::layout::PointerReader<'a>, default: ::core::option::Option<&'a [capnp::Word]>) -> ::capnp::Result<Reader<'a,>> {
      ::core::result::Result::Ok(::capnp::traits::FromStructReader::new(reader.get_struct(default)?))
    }
  }

  impl <'a,> ::capnp::traits::IntoInternalStructReader<'a> for Reader<'a,>  {
    fn into_internal_struct_reader(self) -> ::capnp::private::layout::StructReader<'a> {
      self.reader
    }
  }

  impl <'a,> ::capnp::traits::Imbue<'a> for Reader<'a,>  {
    fn imbue(&mut self, cap_table: &'a ::capnp::private::layout::CapTable) {
      self.reader.imbue(::capnp::private::layout::CapTableReader::Plain(cap_table))
    }
  }

  impl <'a,> Reader<'a,>  {
    pub fn reborrow(&self) -> Reader<'_,> {
      Reader { .. *self }
    }

    pub fn total_size(&self) -> ::capnp::Result<::capnp::MessageSize> {
      self.reader.total_size()
    }
    #[inline]
    pub fn get_uuid(self) -> ::capnp::Result<::capnp::text::Reader<'a>> {
      ::capnp::traits::FromPointerReader::get_from_pointer(&self.reader.get_pointer_field(0), ::core::option::Option::None)
    }
    pub fn has_uuid(&self) -> bool {
      !self.reader.get_pointer_field(0).is_null()
    }
    #[inline]
    pub fn get_data_source_uuid(self) -> ::capnp::Result<::capnp::text::Reader<'a>> {
      ::capnp::traits::FromPointerReader::get_from_pointer(&self.reader.get_pointer_field(1), ::core::option::Option::None)
    }
    pub fn has_data_source_uuid(&self) -> bool {
      !self.reader.get_pointer_field(1).is_null()
    }
    #[inline]
    pub fn get_id(self) -> u32 {
      self.reader.get_data_field::<u32>(0)
    }
    #[inline]
    pub fn get_expansion_factor(self) -> f32 {
      self.reader.get_data_field::<f32>(1)
    }
    #[inline]
    pub fn get_size(self) -> i8 {
      self.reader.get_data_field::<i8>(8)
    }
    #[inline]
    pub fn get_car_number(self) -> i8 {
      self.reader.get_data_field::<i8>(9)
    }
    #[inline]
    pub fn get_income_level(self) -> i32 {
      self.reader.get_data_field::<i32>(3)
    }
    #[inline]
    pub fn get_income_level_group(self) -> ::core::result::Result<crate::household_capnp::household::IncomeLevelGroup,::capnp::NotInSchema> {
      ::capnp::traits::FromU16::from_u16(self.reader.get_data_field::<u16>(5))
    }
    #[inline]
    pub fn get_category(self) -> ::core::result::Result<crate::household_capnp::household::Category,::capnp::NotInSchema> {
      ::capnp::traits::FromU16::from_u16(self.reader.get_data_field::<u16>(8))
    }
    #[inline]
    pub fn get_home_latitude(self) -> i32 {
      self.reader.get_data_field::<i32>(5)
    }
    #[inline]
    pub fn get_home_longitude(self) -> i32 {
      self.reader.get_data_field::<i32>(6)
    }
    #[inline]
    pub fn get_home_nodes_uuids(self) -> ::capnp::Result<::capnp::text_list::Reader<'a>> {
      ::capnp::traits::FromPointerReader::get_from_pointer(&self.reader.get_pointer_field(2), ::core::option::Option::None)
    }
    pub fn has_home_nodes_uuids(&self) -> bool {
      !self.reader.get_pointer_field(2).is_null()
    }
    #[inline]
    pub fn get_home_nodes_travel_times(self) -> ::capnp::Result<::capnp::primitive_list::Reader<'a,i16>> {
      ::capnp::traits::FromPointerReader::get_from_pointer(&self.reader.get_pointer_field(3), ::core::option::Option::None)
    }
    pub fn has_home_nodes_travel_times(&self) -> bool {
      !self.reader.get_pointer_field(3).is_null()
    }
    #[inline]
    pub fn get_home_nodes_distances(self) -> ::capnp::Result<::capnp::primitive_list::Reader<'a,i16>> {
      ::capnp::traits::FromPointerReader::get_from_pointer(&self.reader.get_pointer_field(4), ::core::option::Option::None)
    }
    pub fn has_home_nodes_distances(&self) -> bool {
      !self.reader.get_pointer_field(4).is_null()
    }
    #[inline]
    pub fn get_internal_id(self) -> ::capnp::Result<::capnp::text::Reader<'a>> {
      ::capnp::traits::FromPointerReader::get_from_pointer(&self.reader.get_pointer_field(5), ::core::option::Option::None)
    }
    pub fn has_internal_id(&self) -> bool {
      !self.reader.get_pointer_field(5).is_null()
    }
    #[inline]
    pub fn get_data(self) -> ::capnp::Result<::capnp::text::Reader<'a>> {
      ::capnp::traits::FromPointerReader::get_from_pointer(&self.reader.get_pointer_field(6), ::core::option::Option::None)
    }
    pub fn has_data(&self) -> bool {
      !self.reader.get_pointer_field(6).is_null()
    }
    #[inline]
    pub fn get_is_frozen(self) -> i8 {
      self.reader.get_data_field::<i8>(18)
    }
  }

  pub struct Builder<'a> { builder: ::capnp::private::layout::StructBuilder<'a> }
  impl <'a,> ::capnp::traits::HasStructSize for Builder<'a,>  {
    #[inline]
    fn struct_size() -> ::capnp::private::layout::StructSize { _private::STRUCT_SIZE }
  }
  impl <'a,> ::capnp::traits::HasTypeId for Builder<'a,>  {
    #[inline]
    fn type_id() -> u64 { _private::TYPE_ID }
  }
  impl <'a,> ::capnp::traits::FromStructBuilder<'a> for Builder<'a,>  {
    fn new(builder: ::capnp::private::layout::StructBuilder<'a>) -> Builder<'a, > {
      Builder { builder,  }
    }
  }

  impl <'a,> ::capnp::traits::ImbueMut<'a> for Builder<'a,>  {
    fn imbue_mut(&mut self, cap_table: &'a mut ::capnp::private::layout::CapTable) {
      self.builder.imbue(::capnp::private::layout::CapTableBuilder::Plain(cap_table))
    }
  }

  impl <'a,> ::capnp::traits::FromPointerBuilder<'a> for Builder<'a,>  {
    fn init_pointer(builder: ::capnp::private::layout::PointerBuilder<'a>, _size: u32) -> Builder<'a,> {
      ::capnp::traits::FromStructBuilder::new(builder.init_struct(_private::STRUCT_SIZE))
    }
    fn get_from_pointer(builder: ::capnp::private::layout::PointerBuilder<'a>, default: ::core::option::Option<&'a [capnp::Word]>) -> ::capnp::Result<Builder<'a,>> {
      ::core::result::Result::Ok(::capnp::traits::FromStructBuilder::new(builder.get_struct(_private::STRUCT_SIZE, default)?))
    }
  }

  impl <'a,> ::capnp::traits::SetPointerBuilder for Reader<'a,>  {
    fn set_pointer_builder<'b>(pointer: ::capnp::private::layout::PointerBuilder<'b>, value: Reader<'a,>, canonicalize: bool) -> ::capnp::Result<()> { pointer.set_struct(&value.reader, canonicalize) }
  }

  impl <'a,> Builder<'a,>  {
    pub fn into_reader(self) -> Reader<'a,> {
      ::capnp::traits::FromStructReader::new(self.builder.into_reader())
    }
    pub fn reborrow(&mut self) -> Builder<'_,> {
      Builder { .. *self }
    }
    pub fn reborrow_as_reader(&self) -> Reader<'_,> {
      ::capnp::traits::FromStructReader::new(self.builder.into_reader())
    }

    pub fn total_size(&self) -> ::capnp::Result<::capnp::MessageSize> {
      self.builder.into_reader().total_size()
    }
    #[inline]
    pub fn get_uuid(self) -> ::capnp::Result<::capnp::text::Builder<'a>> {
      ::capnp::traits::FromPointerBuilder::get_from_pointer(self.builder.get_pointer_field(0), ::core::option::Option::None)
    }
    #[inline]
    pub fn set_uuid(&mut self, value: ::capnp::text::Reader<'_>)  {
      self.builder.get_pointer_field(0).set_text(value);
    }
    #[inline]
    pub fn init_uuid(self, size: u32) -> ::capnp::text::Builder<'a> {
      self.builder.get_pointer_field(0).init_text(size)
    }
    pub fn has_uuid(&self) -> bool {
      !self.builder.get_pointer_field(0).is_null()
    }
    #[inline]
    pub fn get_data_source_uuid(self) -> ::capnp::Result<::capnp::text::Builder<'a>> {
      ::capnp::traits::FromPointerBuilder::get_from_pointer(self.builder.get_pointer_field(1), ::core::option::Option::None)
    }
    #[inline]
    pub fn set_data_source_uuid(&mut self, value: ::capnp::text::Reader<'_>)  {
      self.builder.get_pointer_field(1).set_text(value);
    }
    #[inline]
    pub fn init_data_source_uuid(self, size: u32) -> ::capnp::text::Builder<'a> {
      self.builder.get_pointer_field(1).init_text(size)
    }
    pub fn has_data_source_uuid(&self) -> bool {
      !self.builder.get_pointer_field(1).is_null()
    }
    #[inline]
    pub fn get_id(self) -> u32 {
      self.builder.get_data_field::<u32>(0)
    }
    #[inline]
    pub fn set_id(&mut self, value: u32)  {
      self.builder.set_data_field::<u32>(0, value);
    }
    #[inline]
    pub fn get_expansion_factor(self) -> f32 {
      self.builder.get_data_field::<f32>(1)
    }
    #[inline]
    pub fn set_expansion_factor(&mut self, value: f32)  {
      self.builder.set_data_field::<f32>(1, value);
    }
    #[inline]
    pub fn get_size(self) -> i8 {
      self.builder.get_data_field::<i8>(8)
    }
    #[inline]
    pub fn set_size(&mut self, value: i8)  {
      self.builder.set_data_field::<i8>(8, value);
    }
    #[inline]
    pub fn get_car_number(self) -> i8 {
      self.builder.get_data_field::<i8>(9)
    }
    #[inline]
    pub fn set_car_number(&mut self, value: i8)  {
      self.builder.set_data_field::<i8>(9, value);
    }
    #[inline]
    pub fn get_income_level(self) -> i32 {
      self.builder.get_data_field::<i32>(3)
    }
    #[inline]
    pub fn set_income_level(&mut self, value: i32)  {
      self.builder.set_data_field::<i32>(3, value);
    }
    #[inline]
    pub fn get_income_level_group(self) -> ::core::result::Result<crate::household_capnp::household::IncomeLevelGroup,::capnp::NotInSchema> {
      ::capnp::traits::FromU16::from_u16(self.builder.get_data_field::<u16>(5))
    }
    #[inline]
    pub fn set_income_level_group(&mut self, value: crate::household_capnp::household::IncomeLevelGroup)  {
      self.builder.set_data_field::<u16>(5, value as u16)
    }
    #[inline]
    pub fn get_category(self) -> ::core::result::Result<crate::household_capnp::household::Category,::capnp::NotInSchema> {
      ::capnp::traits::FromU16::from_u16(self.builder.get_data_field::<u16>(8))
    }
    #[inline]
    pub fn set_category(&mut self, value: crate::household_capnp::household::Category)  {
      self.builder.set_data_field::<u16>(8, value as u16)
    }
    #[inline]
    pub fn get_home_latitude(self) -> i32 {
      self.builder.get_data_field::<i32>(5)
    }
    #[inline]
    pub fn set_home_latitude(&mut self, value: i32)  {
      self.builder.set_data_field::<i32>(5, value);
    }
    #[inline]
    pub fn get_home_longitude(self) -> i32 {
      self.builder.get_data_field::<i32>(6)
    }
    #[inline]
    pub fn set_home_longitude(&mut self, value: i32)  {
      self.builder.set_data_field::<i32>(6, value);
    }
    #[inline]
    pub fn get_home_nodes_uuids(self) -> ::capnp::Result<::capnp::text_list::Builder<'a>> {
      ::capnp::traits::FromPointerBuilder::get_from_pointer(self.builder.get_pointer_field(2), ::core::option::Option::None)
    }
    #[inline]
    pub fn set_home_nodes_uuids(&mut self, value: ::capnp::text_list::Reader<'a>) -> ::capnp::Result<()> {
      ::capnp::traits::SetPointerBuilder::set_pointer_builder(self.builder.get_pointer_field(2), value, false)
    }
    #[inline]
    pub fn init_home_nodes_uuids(self, size: u32) -> ::capnp::text_list::Builder<'a> {
      ::capnp::traits::FromPointerBuilder::init_pointer(self.builder.get_pointer_field(2), size)
    }
    pub fn has_home_nodes_uuids(&self) -> bool {
      !self.builder.get_pointer_field(2).is_null()
    }
    #[inline]
    pub fn get_home_nodes_travel_times(self) -> ::capnp::Result<::capnp::primitive_list::Builder<'a,i16>> {
      ::capnp::traits::FromPointerBuilder::get_from_pointer(self.builder.get_pointer_field(3), ::core::option::Option::None)
    }
    #[inline]
    pub fn set_home_nodes_travel_times(&mut self, value: ::capnp::primitive_list::Reader<'a,i16>) -> ::capnp::Result<()> {
      ::capnp::traits::SetPointerBuilder::set_pointer_builder(self.builder.get_pointer_field(3), value, false)
    }
    #[inline]
    pub fn init_home_nodes_travel_times(self, size: u32) -> ::capnp::primitive_list::Builder<'a,i16> {
      ::capnp::traits::FromPointerBuilder::init_pointer(self.builder.get_pointer_field(3), size)
    }
    pub fn has_home_nodes_travel_times(&self) -> bool {
      !self.builder.get_pointer_field(3).is_null()
    }
    #[inline]
    pub fn get_home_nodes_distances(self) -> ::capnp::Result<::capnp::primitive_list::Builder<'a,i16>> {
      ::capnp::traits::FromPointerBuilder::get_from_pointer(self.builder.get_pointer_field(4), ::core::option::Option::None)
    }
    #[inline]
    pub fn set_home_nodes_distances(&mut self, value: ::capnp::primitive_list::Reader<'a,i16>) -> ::capnp::Result<()> {
      ::capnp::traits::SetPointerBuilder::set_pointer_builder(self.builder.get_pointer_field(4), value, false)
    }
    #[inline]
    pub fn init_home_nodes_distances(self, size: u32) -> ::capnp::primitive_list::Builder<'a,i16> {
      ::capnp::traits::FromPointerBuilder::init_pointer(self.builder.get_pointer_field(4), size)
    }
    pub fn has_home_nodes_distances(&self) -> bool {
      !self.builder.get_pointer_field(4).is_null()
    }
    #[inline]
    pub fn get_internal_id(self) -> ::capnp::Result<::capnp::text::Builder<'a>> {
      ::capnp::traits::FromPointerBuilder::get_from_pointer(self.builder.get_pointer_field(5), ::core::option::Option::None)
    }
    #[inline]
    pub fn set_internal_id(&mut self, value: ::capnp::text::Reader<'_>)  {
      self.builder.get_pointer_field(5).set_text(value);
    }
    #[inline]
    pub fn init_internal_id(self, size: u32) -> ::capnp::text::Builder<'a> {
      self.builder.get_pointer_field(5).init_text(size)
    }
    pub fn has_internal_id(&self) -> bool {
      !self.builder.get_pointer_field(5).is_null()
    }
    #[inline]
    pub fn get_data(self) -> ::capnp::Result<::capnp::text::Builder<'a>> {
      ::capnp::traits::FromPointerBuilder::get_from_pointer(self.builder.get_pointer_field(6), ::core::option::Option::None)
    }
    #[inline]
    pub fn set_data(&mut self, value: ::capnp::text::Reader<'_>)  {
      self.builder.get_pointer_field(6).set_text(value);
    }
    #[inline]
    pub fn init_data(self, size: u32) -> ::capnp::text::Builder<'a> {
      self.builder.get_pointer_field(6).init_text(size)
    }
    pub fn has_data(&self) -> bool {
      !self.builder.get_pointer_field(6).is_null()
    }
    #[inline]
    pub fn get_is_frozen(self) -> i8 {
      self.builder.get_data_field::<i8>(18)
    }
    #[inline]
    pub fn set_is_frozen(&mut self, value: i8)  {
      self.builder.set_data_field::<i8>(18, value);
    }
  }

  pub struct Pipeline { _typeless: ::capnp::any_pointer::Pipeline }
  impl ::capnp::capability::FromTypelessPipeline for Pipeline {
    fn new(typeless: ::capnp::any_pointer::Pipeline) -> Pipeline {
      Pipeline { _typeless: typeless,  }
    }
  }
  impl Pipeline  {
  }
  mod _private {
    use capnp::private::layout;
    pub const STRUCT_SIZE: layout::StructSize = layout::StructSize { data: 4, pointers: 7 };
    pub const TYPE_ID: u64 = 0xf185_6a7a_7d8f_d18f;
  }

  #[repr(u16)]
  #[derive(Clone, Copy, PartialEq)]
  pub enum IncomeLevelGroup {
    None = 0,
    VeryLow = 1,
    Low = 2,
    Medium = 3,
    High = 4,
    VeryHigh = 5,
    Unknown = 6,
  }
  impl ::capnp::traits::FromU16 for IncomeLevelGroup {
    #[inline]
    fn from_u16(value: u16) -> ::core::result::Result<IncomeLevelGroup, ::capnp::NotInSchema> {
      match value {
        0 => ::core::result::Result::Ok(IncomeLevelGroup::None),
        1 => ::core::result::Result::Ok(IncomeLevelGroup::VeryLow),
        2 => ::core::result::Result::Ok(IncomeLevelGroup::Low),
        3 => ::core::result::Result::Ok(IncomeLevelGroup::Medium),
        4 => ::core::result::Result::Ok(IncomeLevelGroup::High),
        5 => ::core::result::Result::Ok(IncomeLevelGroup::VeryHigh),
        6 => ::core::result::Result::Ok(IncomeLevelGroup::Unknown),
        n => ::core::result::Result::Err(::capnp::NotInSchema(n)),
      }
    }
  }
  impl ::capnp::traits::ToU16 for IncomeLevelGroup {
    #[inline]
    fn to_u16(self) -> u16 { self as u16 }
  }
  impl ::capnp::traits::HasTypeId for IncomeLevelGroup {
    #[inline]
    fn type_id() -> u64 { 0x9aaa_ce5f_6d67_0889u64 }
  }

  #[repr(u16)]
  #[derive(Clone, Copy, PartialEq)]
  pub enum Category {
    None = 0,
    SinglePerson = 1,
    Couple = 2,
    MonoparentalFamily = 3,
    BiparentalFamily = 4,
    Other = 5,
    Unknown = 6,
  }
  impl ::capnp::traits::FromU16 for Category {
    #[inline]
    fn from_u16(value: u16) -> ::core::result::Result<Category, ::capnp::NotInSchema> {
      match value {
        0 => ::core::result::Result::Ok(Category::None),
        1 => ::core::result::Result::Ok(Category::SinglePerson),
        2 => ::core::result::Result::Ok(Category::Couple),
        3 => ::core::result::Result::Ok(Category::MonoparentalFamily),
        4 => ::core::result::Result::Ok(Category::BiparentalFamily),
        5 => ::core::result::Result::Ok(Category::Other),
        6 => ::core::result::Result::Ok(Category::Unknown),
        n => ::core::result::Result::Err(::capnp::NotInSchema(n)),
      }
    }
  }
  impl ::capnp::traits::ToU16 for Category {
    #[inline]
    fn to_u16(self) -> u16 { self as u16 }
  }
  impl ::capnp::traits::HasTypeId for Category {
    #[inline]
    fn type_id() -> u64 { 0xceb6_6461_0adc_2cc4u64 }
  }
}
