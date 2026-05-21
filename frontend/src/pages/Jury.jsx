import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:10000');

export default function Jury() {
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState(null);
  const [points, setPoints] = useState(0);
  const [comment, setComment] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [tournament, setTournament] = useState(null);

  useEffect(() => {
    socket.emit('join', { room: 'jury-room', role: 'jury' });
    socket.on('jury:new_submission', (data) => setPending(prev => [...prev, data]));
    socket.on('game:new_question', (data) => {
      setCurrentQuestion({
        text: data.text || data.question,
        category: data.category || 'Général',
        points: data.points || 0,
        type: data.type || 'question'
      });
    });
    socket.on('tournament:state', setTournament);
    socket.on('tournament:phase1_complete', setTournament);
    socket.on('tournament:phase2_started', setTournament);
    socket.on('phase2:challenge_started', setTournament);
    socket.on('phase2:submission_update', setTournament);
    socket.on('phase2:round_winner', setTournament);
    socket.on('phase2:hint_usage_update', setTournament);
    socket.on('phase2:round_ended', setTournament);
    socket.on('phase2:round_timeout', setTournament);
    socket.on('phase2:round_skipped', setTournament);
    socket.on('phase2:team_eliminated', setTournament);
    socket.on('tournament:phase2_complete', setTournament);
    return () => {
      socket.off('jury:new_submission');
      socket.off('game:new_question');
      socket.off('tournament:state');
      socket.off('tournament:phase1_complete');
      socket.off('tournament:phase2_started');
      socket.off('phase2:challenge_started');
      socket.off('phase2:submission_update');
      socket.off('phase2:round_winner');
      socket.off('phase2:hint_usage_update');
      socket.off('phase2:round_ended');
      socket.off('phase2:round_timeout');
      socket.off('phase2:round_skipped');
      socket.off('phase2:team_eliminated');
      socket.off('tournament:phase2_complete');
    };
  }, []);

  const validate = (accepted) => {
    if (!selected) return;
    socket.emit('jury:validate', { 
      answerId: selected.id, 
      teamId: selected.teamId, 
      accepted, 
      points: accepted ? points : 0, 
      comment 
    });
    setPending(prev => prev.filter(p => p.id !== selected.id));
    setSelected(null); setPoints(0); setComment('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-4">
      <header className="mb-6 pb-4 border-b border-white/20">
        <h1 className="text-2xl font-bold">Espace Jury</h1>
        <p className="text-white/60 text-sm">Validation des réponses complexes</p>
      </header>
      <section className="mb-6 bg-white/10 rounded-2xl p-4 border border-cyan-400/30">
        <div className="flex justify-between gap-3 flex-wrap">
          <div>
            <p className="text-cyan-300 text-xs uppercase tracking-widest">Question synchronisée</p>
            <h2 className="text-xl font-bold mt-1">
              {tournament?.phase2?.currentChallenge?.question || currentQuestion?.text || 'En attente du modérateur...'}
            </h2>
            <p className="text-white/50 text-sm mt-1">
              {tournament?.phase === 'phase2'
                ? `Phase 2 · Round ${tournament?.phase2?.roundNumber || 0} · ${tournament?.phase2?.timer || 0}s`
                : currentQuestion ? `${currentQuestion.category} · ${currentQuestion.points} pts` : 'Phase 1'}
            </p>
          </div>
          {tournament?.phase2?.roundWinner && (
            <div className="bg-green-500/15 border border-green-400/30 rounded-xl px-4 py-3">
              <p className="text-green-300 text-xs uppercase tracking-widest">Winner</p>
              <p className="font-bold">{tournament.phase2.roundWinner.teamName}</p>
            </div>
          )}
        </div>
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
          <h2 className="font-semibold mb-3">En attente ({pending.length + (tournament?.phase2?.submissions?.length || 0)})</h2>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {pending.length === 0 && (tournament?.phase2?.submissions?.length || 0) === 0 ? <p className="text-white/50 text-center py-8">Aucune soumission</p> :
              <>
              {(tournament?.phase2?.submissions || []).map(p => (
                <div key={p.id} className={`p-3 rounded-xl border ${p.correct ? 'bg-green-600/20 border-green-400/40' : 'bg-red-600/15 border-red-400/30'}`}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-bold text-cyan-300">{p.teamName}</span>
                    <span className="text-white/50">{new Date(p.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-sm truncate">{p.answer}</p>
                  <p className="text-xs text-white/50 mt-1">{p.correct ? `Correct +${p.points}` : `Pénalité ${p.penalty}`}</p>
                </div>
              ))}
              {pending.map(p => (
                <div key={p.id} onClick={()=>setSelected(p)} className={`p-3 rounded-xl border cursor-pointer transition ${selected?.id === p.id ? 'bg-indigo-600/30 border-indigo-400' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-bold text-indigo-300">Équipe {p.teamName}</span>
                    <span className="text-white/50">{new Date(p.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-sm truncate">{p.answer}</p>
                </div>
              ))}
              </>
            }
          </div>
        </div>
        <div className="bg-white/10 rounded-2xl p-5 border border-white/20">
          <h2 className="font-semibold mb-4">Analyse & Validation</h2>
          {selected ? (
            <div className="space-y-4">
              <div className="p-4 bg-black/30 rounded-xl">
                <p className="text-xs text-white/50 mb-1">Réponse :</p>
                <p className="font-mono text-lg break-words">{selected.answer}</p>
                <p className="text-xs text-white/50 mt-2">Question : {selected.questionText}</p>
              </div>
              <div>
                <label className="text-sm text-white/70 block mb-2">Points</label>
                <input type="number" value={points} onChange={e=>setPoints(Number(e.target.value))} className="w-full min-h-[48px] bg-white/10 rounded-lg px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-sm text-white/70 block mb-2">Commentaire</label>
                <textarea value={comment} onChange={e=>setComment(e.target.value)} rows="3" className="w-full bg-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Raison..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>validate(true)} className="min-h-[48px] bg-green-600 hover:bg-green-500 active:scale-95 rounded-xl font-bold transition">Valider</button>
                <button onClick={()=>validate(false)} className="min-h-[48px] bg-red-600 hover:bg-red-500 active:scale-95 rounded-xl font-bold transition">Refuser</button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-white/40">
              <p>Sélectionne une réponse</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
