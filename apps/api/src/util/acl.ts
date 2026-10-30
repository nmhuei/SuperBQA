import { config } from '@rctf/config'
import type { ServerConfig } from '@rctf/config'

type ACLCheck = (email: string | undefined) => boolean

interface CompiledACL {
  check: ACLCheck
  divisions: (keyof ServerConfig['divisions'])[]
}

const restrictionChecks: {
  [checkType: string]: (value: string) => ACLCheck
} = {
  domain: value => email => email?.endsWith('@' + value) ?? false,
  email: value => email => email === value,
  regex: value => {
    const re = new RegExp(value)
    return email => (email === undefined ? false : re.test(email))
  },
  any: _value => _email => true,
}

const compileACLs = (): CompiledACL[] => {
  let divisionACLs = config.divisionACLs

  // allow everything if no ACLs or if no email verify
  if (!divisionACLs || divisionACLs.length === 0 || !config.email) {
    divisionACLs = [
      {
        match: 'any',
        value: '',
        divisions: Object.keys(config.divisions),
      },
    ]
  }

  return divisionACLs.map(({ match, value, divisions }) => {
    const checkItem = restrictionChecks[match]
    if (!checkItem) {
      throw new Error(`Unsupported ACL check: ${match}`)
    }
    return { check: checkItem(value), divisions }
  })
}

export const compiledACLs = compileACLs()

export const allDivisions = Object.keys(config.divisions)
export const defaultDivision: string =
  config.defaultDivision || allDivisions[0] || 'default'

export const allowedDivisions = ({
  email,
  defaultOnly,
}: {
  email: string | null | undefined
  defaultOnly: boolean
}): string[] => {
  if (!config.divisionACLs) {
    return defaultOnly ? [defaultDivision] : allDivisions
  }

  if (!email || !config.email) {
    return [defaultDivision]
  }

  let result: string[] = []
  for (const acl of compiledACLs) {
    if (acl.check(email)) {
      result = result.concat(acl.divisions)
    }
  }

  if (result.length === 0) {
    result.push(defaultDivision)
  }

  return defaultOnly ? [defaultDivision] : Array.from(new Set(result))
}

export const divisionAllowed = (
  email: string | null | undefined,
  division: string
): boolean => {
  return allowedDivisions({
    email,
    defaultOnly: false,
  }).includes(division)
}
