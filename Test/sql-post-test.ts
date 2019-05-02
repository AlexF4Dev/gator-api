// tslint:disable:no-any
// tslint:disable:no-invalid-this
import {expect} from 'chai';
import {Context as MochaContext} from 'mocha';
import {doesNotReject} from 'assert';
import {Observable, of, Subject} from 'rxjs';
import * as jsonBadData from './data/Sample.data.json';
import {SQLRepository, Tenant} from '../Lib/sqlRepository';
import {GitRepository} from '../Lib/GitRepository';


describe('Testing SQLRepository POST - Save Tenant', () => {
  it('should return rowsAffected', async () => {
    let sqlRepositoy = new SQLRepository(null);
    let tenant = new Tenant();
    tenant.AuthToken = 'XXXX';
    tenant.RefreshToken = 'XXXX';
    tenant.UserName = 'Rafat';
    tenant.DisplayName = 'Rafat Sarosh';
    tenant.Photo = 'url for the photo';
    tenant.ProfileUrl = 'Profile';
    tenant.Id = 999;
    tenant.Email = "rsarosh@hotmail.com";
 

    await sqlRepositoy.saveTenant(tenant).then(result => {
      expect(result.rowsAffected[0]).to.eq(1);
    });
  });
});

describe('FillPullRequest', () => {
  it.only('should return rowsAffected', async () => {
    let gitRepository = new GitRepository();
    await gitRepository.FillPullRequest('1040817', 'LabShare', 'forms',true, true, '').then(result => {
      expect(result.recordset.length).to.greaterThan(0);
      console.log(result.recordset[0]);
    });
  });
});



