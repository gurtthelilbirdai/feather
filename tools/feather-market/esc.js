function esc(s){return String(s).split('&').join('&#38;').split('<').join('&#60;').split('>').join('&#62;').split(String.fromCharCode(34)).join('&#34;').split(String.fromCharCode(39)).join(''');}
