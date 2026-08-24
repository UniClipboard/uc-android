import {
  deleteLanServerPassword,
  getLanServerPassword,
  setLanServerPassword,
} from 'app-group-store';

export const lanServerSecretStore = {
  get: getLanServerPassword,
  set: setLanServerPassword,
  delete: deleteLanServerPassword,
};
