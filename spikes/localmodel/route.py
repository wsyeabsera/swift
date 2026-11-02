# Spike #1709: can a small local model route a Say request: token swap / property tweak / full edit, in < 400 ms?
import json, time, sys
from mlx_lm import load, generate
cases = json.load(open('cases.json'))
t0 = time.time(); model, tok = load('mlx-community/Qwen3-4B-Instruct-2507-4bit'); print(f'load {time.time()-t0:.1f}s')
SYS = ("Classify a design edit request for a UI canvas. Answer with exactly one word.\n"
       "token = swap a design token (colour, font family, theme, background, glass) to another existing value.\n"
       "property = change one numeric/layout/visibility property of the selected element (size, padding, position, radius, weight, blur, hide).\n"
       "full = anything creative or structural that needs a designer (new elements, redesign, copy, multiple variants).")
def ask(u):
    msgs = [{'role': 'system', 'content': SYS}, {'role': 'user', 'content': u}]
    p = tok.apply_chat_template(msgs, add_generation_prompt=True, tokenize=False)
    t = time.time(); out = generate(model, tok, prompt=p, max_tokens=3, verbose=False); return out.strip().lower().split()[0].strip('.,') if out.strip() else '', (time.time() - t) * 1000
ask('warm up'); ok = 0; times = []; wrong = []
for u, lab in cases:
    got, ms = ask(u); times.append(ms); ok += got == lab
    if got != lab: wrong.append((u, lab, got))
times.sort(); print(f'accuracy {ok}/{len(cases)} = {100*ok/len(cases):.0f}%  median {times[len(times)//2]:.0f} ms  p95 {times[int(len(times)*.95)]:.0f} ms')
for w in wrong: print('MISS', w)
