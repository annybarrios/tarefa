import React, { useState, useEffect } from 'react';

export class ApiError extends Error {
  constructor(status, statusText) {
    super(`Erro ${status}: ${statusText}`);
    this.status = status;
    this.statusText = statusText;
    this.name = 'ApiError';
  }
}

export const BASE_URL = 'http://localhost:3000'; 

if (!localStorage.getItem('mock_users')) {
  localStorage.setItem('mock_users', JSON.stringify([
    { id: '1', nome: 'Ana Costa', email: 'ana@email.com' },
    { id: '2', nome: 'Carlos Souza', email: 'carlos@email.com' }
  ]));
}

window.fetch = async function (url, configuracao = {}) {
  await new Promise(resolve => setTimeout(resolve, 500)); 

  if (configuracao.signal?.aborted) {
    throw new DOMException('The user aborted a request.', 'AbortError');
  }

  const endpoint = url.replace(BASE_URL, '');
  const metodo = configuracao.method || 'GET';
  let usuarios = JSON.parse(localStorage.getItem('mock_users') || '[]');

  if (endpoint === '/users' && metodo === 'GET') {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => usuarios
    };
  }

  if (endpoint === '/users' && metodo === 'POST') {
    const corpo = JSON.parse(configuracao.body);
    const novoUsuario = { id: String(Date.now()), ...corpo };
    usuarios.push(novoUsuario);
    localStorage.setItem('mock_users', JSON.stringify(usuarios));
    return {
      ok: true,
      status: 201,
      statusText: 'Created',
      json: async () => novoUsuario
    };
  }

  if (endpoint.startsWith('/users/') && metodo === 'PUT') {
    const id = endpoint.split('/')[2];
    const corpo = JSON.parse(configuracao.body);
    let usuarioAtualizado = null;
    
    usuarios = usuarios.map(u => {
      if (u.id === id) {
        usuarioAtualizado = { ...u, ...corpo };
        return usuarioAtualizado;
      }
      return u;
    });
    
    localStorage.setItem('mock_users', JSON.stringify(usuarios));
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => usuarioAtualizado
    };
  }

  if (endpoint.startsWith('/users/') && metodo === 'DELETE') {
    const id = endpoint.split('/')[2];
    usuarios = usuarios.filter(u => u.id !== id);
    localStorage.setItem('mock_users', JSON.stringify(usuarios));
    return {
      ok: true,
      status: 204,
      statusText: 'No Content'
    };
  }

  return {
    ok: false,
    status: 404,
    statusText: 'Not Found'
  };
};

async function requisicao(endpoint, opcoes = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const { headers: headersExtras, ...outrasOpcoes } = opcoes;
  
  const headersPadrao = {
    'Content-Type': 'application/json',
  };

  const configuracao = {
    ...outrasOpcoes,
    headers: {
      ...headersPadrao,
      ...headersExtras,
    },
  };

  try {
    const resposta = await fetch(url, configuracao);

    if (!resposta.ok) {
      throw new ApiError(resposta.status, resposta.statusText);
    }

    if (resposta.status === 204) return null;
    return await resposta.json();
    
  } catch (erro) {
    if (erro.name === 'AbortError') {
      throw erro;
    }
    throw erro;
  }
}

export async function apiGet(endpoint, opcoes = {}) {
  return requisicao(endpoint, { ...opcoes, method: 'GET' });
}

export async function apiPost(endpoint, corpo, opcoes = {}) {
  return requisicao(endpoint, { 
    ...opcoes, 
    method: 'POST', 
    body: JSON.stringify(corpo) 
  });
}

export async function apiPut(endpoint, corpo, opcoes = {}) {
  return requisicao(endpoint, { 
    ...opcoes, 
    method: 'PUT', 
    body: JSON.stringify(corpo) 
  });
}

export async function apiDelete(endpoint, opcoes = {}) {
  return requisicao(endpoint, { ...opcoes, method: 'DELETE' });
}

export default function App() {
  const [usuarios, setUsuarios] = useState([]);
  const [erroMensagem, setErroMensagem] = useState('');
  const [carregando, setCarregando] = useState(false);

  const [nomeInput, setNomeInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [idEditando, setIdEditando] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function carregarUsuarios() {
      setCarregando(true);
      setErroMensagem('');
      
      try {
        const dados = await apiGet('/users', { signal });
        setUsuarios(dados);
      } catch (erro) {
        if (erro.name === 'AbortError') return;

        if (erro instanceof ApiError) {
          if (erro.status === 404) {
            setErroMensagem('Recurso não encontrado');
          } else if (erro.status === 500) {
            setErroMensagem('Erro no servidor');
          } else {
            setErroMensagem(`Erro inesperado: ${erro.status}`);
          }
        } else {
          setErroMensagem('Falha de rede');
        }
      } finally {
        setCarregando(false);
      }
    }

    carregarUsuarios();

    return () => {
      controller.abort();
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nomeInput || !emailInput) return;

    const dadosForm = { nome: nomeInput, email: emailInput };

    try {
      if (idEditando) {
        const usuarioAtualizado = await apiPut(`/users/${idEditando}`, dadosForm);
        setUsuarios((antigos) =>
          antigos.map((u) => (u.id === idEditando ? usuarioAtualizado : u))
        );
        setIdEditando(null);
      } else {
        const novoUsuario = await apiPost('/users', dadosForm, {
          headers: { 'X-Custom': 'aula07' }
        });
        setUsuarios((antigos) => [...antigos, novoUsuario]);
      }

      setNomeInput('');
      setEmailInput('');
    } catch (erro) {
      alert('Ocorreu um erro ao salvar as informações.');
    }
  }

  function iniciarEdicao(usuario) {
    setIdEditando(usuario.id);
    setNomeInput(usuario.nome);
    setEmailInput(usuario.email);
  }

  async function handleDeletar(id) {
    try {
      await apiDelete(`/users/${id}`);
      setUsuarios((antigos) => antigos.filter((u) => u.id !== id));
    } catch (erro) {
      alert('Não foi possível excluir o usuário.');
    }
  }

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto' }}>
      <h1>Gerenciamento de Usuários</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3>{idEditando ? 'Editar Usuário' : 'Novo Usuário'}</h3>
        <input 
          type="text" 
          placeholder="Nome" 
          value={nomeInput} 
          onChange={(e) => setNomeInput(e.target.value)} 
          style={{ padding: '8px' }}
        />
        <input 
          type="email" 
          placeholder="E-mail" 
          value={emailInput} 
          onChange={(e) => setEmailInput(e.target.value)} 
          style={{ padding: '8px' }}
        />
        <button type="submit" style={{ padding: '8px', cursor: 'pointer' }}>{idEditando ? 'Atualizar' : 'Salvar'}</button>
        {idEditando && <button type="button" onClick={() => { setIdEditando(null); setNomeInput(''); setEmailInput(''); }} style={{ padding: '8px' }}>Cancelar</button>}
      </form>

      <hr />

      {carregando && <p>Buscando dados no simulador de servidor...</p>}
      {erroMensagem && <p style={{ color: 'red', fontWeight: 'bold', padding: '10px', background: '#fee' }}>⚠️ {erroMensagem}</p>}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {usuarios.map((u) => (
          <li key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
            <div>
              <strong>{u.nome}</strong> <br />
              <small style={{ color: '#666' }}>{u.email}</small>
            </div>
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              <button onClick={() => iniciarEdicao(u)}>Editar</button>
              <button onClick={() => handleDeletar(u.id)} style={{ color: 'red' }}>Excluir</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
