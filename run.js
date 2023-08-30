const axios = require('axios').default
const core = require('@actions/core')

ALLOWED_PROTOCOLS = ['tcp', 'udp']

const accessToken = core.getInput('access-token', { required: true })
const firewallId = core.getInput('firewall-id', { required: true })
const dryRun = core.getBooleanInput('dry-run')

/**
 * Parse ports from string. This also add protocol if not specified.
 * @param { string } ports Ports as string, separated by comma.
 * @returns { string[] } Ports with protocol
 */
function parsePorts(ports) {
  return ports.split(',').map((port) => {
    if (!port.includes('/')) {
      return `${port}/tcp`
    }

    return port
  })
}

/**
 * Get current IP
 * @returns {string} Current IP
 */
async function getIP() {
  const response = await axios.get('https://ifconfig.me/ip')
  return response.data
}

/**
 *
 * @param { 'add' | 'remove' } method Action to do with firewall rules
 * @param { { protocol: string, ports: string, sources: { addresses: string[] } } } rules Inbound rules to add/delete
 * @returns
 */
async function updateFirewallRules(method, rules) {
  const httpMethod = method === 'add' ? 'post' : 'delete'
  const data = {
    inbound_rules: rules,
  }

  core.info(`Rules to ${method}:`)
  const rulesString = JSON.stringify(rules, null, 2)
  core.info(rulesString)

  if (!dryRun) {
    await axios({
      method: httpMethod,
      url: `https://api.digitalocean.com/v2/firewalls/${firewallId}/rules`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data,
      responseType: 'json',
    })

    core.info('Sent')
  } else {
    core.info('Done (dry run)')
  }
}

/**
 * Run an action
 * @param { 'add' | 'remove' } method Action to do with firewall rules
 */
module.exports = async function (method) {
  try {
    const ports = parsePorts(core.getInput('ports'))

    const ip = await getIP()
    core.info(`Current IP: ${ip}`)
    core.setOutput('runner-ip', ip)

    const inboundRules = ports.map((port) => ({
      protocol: port.split('/')[1],
      ports: port.split('/')[0],
      sources: {
        addresses: [ip],
      },
    }))

    await updateFirewallRules(method, inboundRules)
  } catch (error) {
    core.setFailed(error.message)
  }
}
