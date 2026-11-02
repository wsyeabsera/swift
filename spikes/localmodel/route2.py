# Spike #1709 pass 2: few-shot examples + cached system prefix.
import json, time, copy
import mlx.core as mx
from mlx_lm import load, generate
from mlx_lm.models.cache import make_prompt_cache
cases = json.load(open('cases.json'))
model, tok = load('mlx-community/Qwen3-4B-Instruct-2507-4bit')
SYS = """Classify a request to edit a UI design. Answer with exactly one word: token, property or full.
token: switch to another existing design token: a brand colour, text colour, font family, theme, backdrop photo or glass style.
property: change ONE layout or numeric value of the selected element: size, padding, position, alignment, radius, weight, blur, visibility.
full: anything creative or structural: new elements, copy writing, redesign, a mood, several variants.
Examples:
use the primary colour for the heading -> token
switch the font to Inter -> token
make the card background the dark theme -> token
set the glass to thin -> token
make the label colour the muted grey -> token
make the icon 24 px -> property
move the badge 12 px left -> property
centre the title -> property
hide the subtitle -> property
make the border radius 20 -> property
add a footer with three links -> full
write a shorter headline -> full
make it feel more playful -> full
give me three alternatives -> full
redesign this as a mobile layout -> full"""
msgs0 = [{'role': 'system', 'content': SYS}]
prefix = tok.apply_chat_template(msgs0, tokenize=False)
pre_ids = tok.encode(prefix)
base = make_prompt_cache(model)
model(mx.array(pre_ids)[None], cache=base); mx.eval([c.state for c in base])
def ask(u):
    full = tok.apply_chat_template(msgs0 + [{'role': 'user', 'content': u}], add_generation_prompt=True, tokenize=False)
    assert full.startswith(prefix)
    ids = tok.encode(full)[len(pre_ids):]
    t = time.time(); out = generate(model, tok, prompt=ids, max_tokens=3, verbose=False, prompt_cache=copy.deepcopy(base))
    return (out.strip().lower().split() or [''])[0].strip('.,'), (time.time() - t) * 1000
ask('warm up'); ok = 0; times = []; wrong = []
for u, lab in cases:
    got, ms = ask(u); times.append(ms); ok += got == lab
    if got != lab: wrong.append((u, lab, got))
times.sort(); print(f'accuracy {ok}/{len(cases)} = {100*ok/len(cases):.0f}%  median {times[len(times)//2]:.0f} ms  p95 {times[int(len(times)*.95)]:.0f} ms')
for w in wrong: print('MISS', w)
