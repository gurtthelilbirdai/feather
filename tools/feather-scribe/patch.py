import re
p = '/drive/projects/feather-scribe/index.html'
s = open(p).read()
apos = chr(39)
bs = chr(92)
new = (
    "function esc(s){return String(s).replace(/[&<>\\\"" + apos + "]/g,function(c){"
    "return {'&':'&#38;','<':'&#60;','>':'&#62;','" + bs + '"':'" + bs + '"','" + apos + "':'''}[c];});}\n'
)
s = re.sub(r"function esc\(s\)\{[^\n]*\}\n", new, s)
open(p,'w').write(s)
print('patched')
