import * as express from "express"
import * as bodyParser from "body-parser"
import * as FabricCAServices from 'fabric-ca-client';
import { FileSystemWallet, Gateway,X509WalletMixin } from 'fabric-network';
import * as fs from 'fs';
import * as path from 'path';

const app = express()
// Initialise HL connection params
const ccpPath = path.resolve(__dirname, '..', 'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

// Initialise Express Rest server
app.set("port", 4141)
app.use(bodyParser.json())

app.get("/enrollAdmin", async (request:any,response:any)=>{
    let res = await enrollAdmin()
    response.send(res)
})

app.get("/enrollPeer", async (request:any,response:any)=>{
    let res = await enrollPeer()
    response.send(res)
})

app.post("/getCampaign", async (req,res)=>{
    let result = await query("retrieveCampaign",[req.body.campaignName])
    res.json(JSON.parse(result))
})

app.post("/createCampaign", async (req,res)=>{
    let result = await invoke("createCampaign", [req.body.campaignName])
    res.send(result)
})

app.post("/closeCampaign", async (req,res)=>{
    let result = await invoke("closeCampaign", [req.body.campaignName])
    res.send(result)
})

app.post("/addDonation", async (req,res)=> {
    let args = [req.body.donationType,req.body.campaignName,req.body.donorName,req.body.amount,Date.now().toString()]
    let result = await invoke("addDonation", args)
    res.send(result)
})


app.listen(app.get("port"),()=> {
    console.log(`Server listening on port: ${app.get("port")}`)
})

async function enrollAdmin():Promise<string> {
    try {

        // Create a new CA client for interacting with the CA.
        const caURL = ccp.certificateAuthorities['ca.example.com'].url;
        const ca = new FabricCAServices(caURL);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the admin user.
        const adminExists = await wallet.exists('admin');
        if (adminExists) {
            console.log('An identity for the admin user "admin" already exists in the wallet');
            return;
        }

        // Enroll the admin user, and import the new identity into the wallet.
        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        const identity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
        wallet.import('admin', identity);
        return 'Successfully enrolled admin user "admin" and imported it into the wallet'

    } catch (error) {
        return `Failed to enroll admin user "admin": ${error}`
    }
}

async function enrollPeer() {
    try {

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userExists = await wallet.exists('user1');
        if (userExists) {
            console.log('An identity for the user "user1" already exists in the wallet');
            return;
        }

        // Check to see if we've already enrolled the admin user.
        const adminExists = await wallet.exists('admin');
        if (!adminExists) {
            console.log('An identity for the admin user "admin" does not exist in the wallet');
            console.log('Run the enrollAdmin.ts application before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: false } });

        // Get the CA client object from the gateway for interacting with the CA.
        const ca = gateway.getClient().getCertificateAuthority();
        const adminIdentity = gateway.getCurrentIdentity();

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({ affiliation: 'org1.department1', enrollmentID: 'user1', role: 'client' }, adminIdentity);
        const enrollment = await ca.enroll({ enrollmentID: 'user1', enrollmentSecret: secret });
        const userIdentity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
        wallet.import('user1', userIdentity);
        return('Successfully registered and enrolled admin user "user1" and imported it into the wallet');

    } catch (error) {
        return(`Failed to register user "user1": ${error}`);
    }
}

async function invoke(functionCall:string,args:string[]):Promise<string>{
    try {

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userExists = await wallet.exists('user1');
        if (!userExists) {
            console.log('An identity for the user "user1" does not exist in the wallet');
            console.log('Run the registerUser.ts application before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: 'user1', discovery: { enabled: false } });

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork('mychannel');

        // Get the contract from the network.
        const contract = network.getContract('addDonation');

        // Submit the specified transaction.
        await contract.submitTransaction(functionCall,...args);
        // Disconnect from the gateway.
        await gateway.disconnect();
        return(`Transaction has been submitted`);


    } catch (error) {
        return(`Failed to submit transaction: ${error}`);
        
    }
}

async function query(functionCall:string,args:string[]): Promise<string>{
    try {

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userExists = await wallet.exists('user1');
        if (!userExists) {
            console.log('An identity for the user "user1" does not exist in the wallet');
            console.log('Run the registerUser.ts application before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: 'user1', discovery: { enabled: false } });

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork('mychannel');

        // Get the contract from the network.
        const contract = network.getContract('addDonation');

        // Evaluate the specified transaction.
        // queryCar transaction - requires 1 argument, ex: ('queryCar', 'CAR4')
        // queryAllCars transaction - requires no arguments, ex: ('queryAllCars')
        const result = await contract.evaluateTransaction(functionCall,...args);
        return result.toString()

    } catch (error) {
        return(`Failed to evaluate transaction: ${error}`);
    }
}