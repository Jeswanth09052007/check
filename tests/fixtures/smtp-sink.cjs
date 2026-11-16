const net = require('node:net');

async function startSmtp() {
  const messages = [];
  const sockets = new Set();
  let reject = false;
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    socket.setEncoding('utf8');
    socket.write('220 localhost ESMTP\r\n');
    let pending = '', recipient = '', data = null;
    socket.on('data', chunk => {
      pending += chunk;
      let end;
      while ((end = pending.indexOf('\r\n')) >= 0) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 2);
        if (data !== null) {
          if (line === '.') {
            messages.push({ to: recipient, message: data });
            data = null;
            socket.write('250 accepted\r\n');
          } else data += line.replace(/^\.\./, '.') + '\r\n';
        } else if (/^(EHLO|HELO) /i.test(line)) socket.write('250 localhost\r\n');
        else if (/^RCPT TO:/i.test(line)) {
          recipient = line.match(/<([^>]+)>/)?.[1];
          socket.write(reject ? '550 rejected\r\n' : '250 ok\r\n');
        } else if (line === 'DATA') {
          data = '';
          socket.write('354 Send message\r\n');
        } else if (line === 'QUIT') socket.end('221 bye\r\n');
        else socket.write('250 ok\r\n');
      }
    });
  });
  await new Promise((resolve, reject) =>
    server.once('error', reject).listen(0, '127.0.0.1', resolve),
  );
  return {
    messages,
    setReject: value => { reject = value; },
    env: {
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(server.address().port),
      SMTP_FROM: 'indai@example.test',
      SMTP_USER: '',
      SMTP_PASS: '',
      OTP_DELIVERY_MODE: 'smtp',
    },
    close() {
      for (const socket of sockets) socket.destroy();
      return new Promise(resolve => server.close(resolve));
    },
  };
}

module.exports = { startSmtp };
