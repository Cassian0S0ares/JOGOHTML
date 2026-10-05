import json, re, math, os, shutil, sys
from PIL import Image

SRC = '/home/cranio/GameMakerProjects/projetotuba'
OUT = '/home/cranio/JOGOHTML'

def load_yy(path):
    t = open(path).read()
    t = re.sub(r',(\s*[}\]])', r'\1', t)
    return json.loads(t)

SPRITES = ['spr_senatir_up', 'spr_senatir_down', 'spr_senatir_left', 'spr_senatir_right',
           'spr_virus_up', 'spr_virus_down', 'spr_virus_left', 'spr_virus_right',
           'spr_prop', 'spr_tree', 'spr_bush', 'spr_grass_tuft',
           'spr_antivirus_combat_axe', 'spr_combat_bg', 'spr_font_ui',
           'spr_senatir_face_01', 'spr_ts_dungeon']

os.makedirs(f'{OUT}/assets/sprites', exist_ok=True)
os.makedirs(f'{OUT}/assets/sounds', exist_ok=True)
meta = {}
for name in SPRITES:
    d = load_yy(f'{SRC}/sprites/{name}/{name}.yy')
    frames = [f['name'] for f in d['frames']]
    w, h, n = d['width'], d['height'], len(frames)
    cols = n if n <= 8 else math.ceil(math.sqrt(n))
    rows = math.ceil(n / cols)
    sheet = Image.new('RGBA', (cols * w, rows * h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        im = Image.open(f'{SRC}/sprites/{name}/{f}.png').convert('RGBA')
        sheet.paste(im, ((i % cols) * w, (i // cols) * h))
    sheet.save(f'{OUT}/assets/sprites/{name}.png', optimize=True)
    meta[name] = {'w': w, 'h': h, 'n': n, 'cols': cols,
                  'xo': d['sequence']['xorigin'], 'yo': d['sequence']['yorigin'],
                  'bbox': [d['bbox_left'], d['bbox_top'], d['bbox_right'], d['bbox_bottom']]}

for s in ['snd_combat_music', 'snd_overworld_music', 'snd_dice_roll']:
    shutil.copy(f'{SRC}/sounds/{s}/{s}.ogg', f'{OUT}/assets/sounds/{s}.ogg')

# Sala: camadas de tiles descompactadas (formato 1: n<0 repete o próximo valor -n vezes, n>0 copia n valores)
room = load_yy(f'{SRC}/rooms/Room1/Room1.yy')
def decode(data, total):
    out, i = [], 0
    while i < len(data):
        n = data[i]
        if n < 0:
            out += [data[i + 1]] * (-n); i += 2
        else:
            out += data[i + 1:i + 1 + n]; i += 1 + n
    assert len(out) == total, (len(out), total)
    return out

layers, instances = {}, []
for L in room['layers']:
    if L['resourceType'] == 'GMRTileLayer':
        w, h = L['tiles']['SerialiseWidth'], L['tiles']['SerialiseHeight']
        layers[L['name']] = {'w': w, 'h': h, 'tiles': decode(L['tiles']['TileCompressedData'], w * h)}
    elif L['resourceType'] == 'GMRInstanceLayer':
        for inst in L['instances']:
            instances.append({'object': inst['objectId']['name'], 'x': inst['x'], 'y': inst['y'],
                              'image_index': inst['imageIndex']})

data = {
    'sprites': meta,
    'room': {'width': room['roomSettings']['Width'], 'height': room['roomSettings']['Height'],
             'tile_size': 32, 'layers': layers, 'instances': instances}
}
with open(f'{OUT}/js/data.js', 'w') as f:
    f.write('// Gerado a partir do projeto GameMaker (sprites e Room1). Não editar à mão.\n')
    f.write('const GAME_DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n')
print({k: (v['n'], v['cols']) for k, v in meta.items()})
