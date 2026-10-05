CREATE EXTENSION xml2;
SELECT xml_valid('<!DOCTYPE root [<!ELEMENT root EMPTY>]><root><child/></root>') AS xml2_xml_valid_alias;
SELECT xml_is_well_formed_document('<!DOCTYPE root [<!ELEMENT root EMPTY>]><root><child/></root>') AS builtin_well_formed;
