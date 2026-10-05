SELECT current_setting('server_version') AS server_version;
SELECT xml_is_well_formed_document('<!DOCTYPE root [<!ELEMENT root EMPTY>]><root><child/></root>') AS well_formed_but_dtd_invalid;
SELECT xmlserialize(document xmlparse(document '<!DOCTYPE root [<!ELEMENT root EMPTY>]><root><child/></root>') AS text) AS parsed_document;
