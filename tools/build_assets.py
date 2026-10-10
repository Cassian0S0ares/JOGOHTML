import json, re, math, os, shutil, sys
from PIL import Image

# Converte o projeto GameMaker para o jogo HTML: sprites em folhas (assets/sprites), sons e as rooms em js/data.js
SRC = sys.argv[1] if len(sys.argv) > 1 else '/home/cranio/GameMakerProjects/projetotuba'
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_yy(path):
    t = open(path, encoding='utf-8').read()
    t = re.sub(r',(\s*[}\]])', r'\1', t)
    return json.loads(t)

SPRITES = [
    # Antivírus (Senatir) e retratos
    'spr_senatir_up', 'spr_senatir_down', 'spr_senatir_left', 'spr_senatir_right', 'spr_senatir_face_01',
    'spr_antivirus_combat_axe', 'spr_antivirus_sentado', 'spr_fogueira',
    # Vírus
    'spr_virus_up', 'spr_virus_down', 'spr_virus_left', 'spr_virus_right', 'spr_virus_face',
    'spr_virus_elite_up', 'spr_virus_elite_down', 'spr_virus_elite_left', 'spr_virus_elite_right', 'spr_virus_elite_combat_claw',
    # Firewall e Cavalo de Troia
    'spr_firewall_up', 'spr_firewall_down', 'spr_firewall_left', 'spr_firewall_right',
    'spr_firewall_combat_fire', 'spr_firewall_face_01', 'spr_firewall_sentado',
    'spr_cavalo_troia_idle', 'spr_cavalo_troia_charge', 'spr_cavalo_troia_defeat', 'spr_cavalo_troia_summon', 'spr_cavalo_troia_face',
    # DDoS e portal
    'spr_ddos', 'spr_ddos_face', 'spr_portal',
    # Mapa
    'spr_prop', 'spr_tree', 'spr_bush', 'spr_grass_tuft', 'spr_computer', 'spr_ts_dungeon', 'spr_ts_lab',
    # Interface
    'spr_combat_bg', 'spr_font_ui',
]

# Desenhos grandes que aparecem sempre reduzidos: a folha sai menor, o tamanho lógico (origem, caixa) continua o do GameMaker
TEXTURE_SCALE = {
    'spr_ddos': 0.5,
    'spr_portal': 0.5,
    'spr_firewall_face_01': 0.3,
    'spr_senatir_face_01': 0.6,
}

SOUNDS = ['snd_overworld_music', 'snd_combat_music', 'snd_boss_music', 'snd_dice_roll']
ROOMS = ['Room1', 'Room2']

os.makedirs(f'{OUT}/assets/sprites', exist_ok=True)
os.makedirs(f'{OUT}/assets/sounds', exist_ok=True)

meta = {}
for name in SPRITES:
    d = load_yy(f'{SRC}/sprites/{name}/{name}.yy')
    frames = [f['name'] for f in d['frames']]
    w, h, n = d['width'], d['height'], len(frames)
    k = TEXTURE_SCALE.get(name, 1)
    tw, th = max(1, round(w * k)), max(1, round(h * k))
    cols = n if n <= 8 else math.ceil(math.sqrt(n))
    rows = math.ceil(n / cols)
    sheet = Image.new('RGBA', (cols * tw, rows * th), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        im = Image.open(f'{SRC}/sprites/{name}/{f}.png').convert('RGBA')
        if k != 1: im = im.resize((tw, th), Image.LANCZOS)
        sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
    sheet.save(f'{OUT}/assets/sprites/{name}.png', optimize=True)
    s = d['sequence']
    entry = {'w': w, 'h': h, 'n': n, 'cols': cols, 'xo': s['xorigin'], 'yo': s['yorigin'],
             'speed': s['playbackSpeed'],
             'bbox': [d['bbox_left'], d['bbox_top'], d['bbox_right'], d['bbox_bottom']]}
    if k != 1: entry.update({'tw': tw, 'th': th})
    meta[name] = entry

volumes = {}
for s in SOUNDS:
    shutil.copy(f'{SRC}/sounds/{s}/{s}.ogg', f'{OUT}/assets/sounds/{s}.ogg')
    volumes[s] = load_yy(f'{SRC}/sounds/{s}/{s}.yy').get('volume', 1)

tilesets = {}
for p in os.listdir(f'{SRC}/tilesets'):
    d = load_yy(f'{SRC}/tilesets/{p}/{p}.yy')
    tilesets[p] = d['spriteId']['name']

# Camadas de tiles descompactadas (formato 1: n<0 repete o próximo valor -n vezes, n>0 copia n valores)
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

rooms = {}
for room_name in ROOMS:
    room = load_yy(f'{SRC}/rooms/{room_name}/{room_name}.yy')
    layers, by_name = [], {}
    for L in room['layers']:
        if L['resourceType'] == 'GMRTileLayer':
            w, h = L['tiles']['SerialiseWidth'], L['tiles']['SerialiseHeight']
            sprite = tilesets[L['tilesetId']['name']]
            assert sprite in meta or not L['visible'], sprite
            layers.append({'name': L['name'], 'depth': L['depth'], 'visible': L['visible'], 'sprite': sprite,
                           'w': w, 'h': h, 'tiles': decode(L['tiles']['TileCompressedData'], w * h)})
        elif L['resourceType'] == 'GMRInstanceLayer':
            for inst in L['instances']:
                by_name[inst['name']] = {'object': inst['objectId']['name'], 'x': inst['x'], 'y': inst['y'],
                                         'image_index': inst['imageIndex']}
    # Create na ordem de criação da room
    order = [x['name'] for x in room['instanceCreationOrder']]
    instances = [by_name[n] for n in order] + [v for k, v in by_name.items() if k not in order]
    rooms[room_name] = {'width': room['roomSettings']['Width'], 'height': room['roomSettings']['Height'],
                        'tile_size': 32, 'layers': layers, 'instances': instances}

data = {'sprites': meta, 'sounds': volumes, 'rooms': rooms, 'room_order': ROOMS}
with open(f'{OUT}/js/data.js', 'w', encoding='utf-8') as f:
    f.write('// Gerado por tools/build_assets.py a partir do projeto GameMaker (sprites, sons e rooms). Não editar à mão.\n')
    f.write('const GAME_DATA = ' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';\n')
print({k: (v['n'], v['cols']) for k, v in meta.items()})
