import Web3 from 'web3';
import { newKitFromWeb3 } from '@celo/contractkit';
import BigNumber from "bignumber.js";
import anypixelsAbi from '../contract/anypixels.abi.json';
import erc20Abi from "../contract/erc20.abi.json";

const ERC20_DECIMALS = 18;
const APContractAddress = "0x330252A4d2A156211De5d298A929E24Aea4C2409";
const cUSDContractAddress = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";

let kit;
let contract;
let canvases = [];

initModal();

//add primary event listener
document.querySelector("#connect").addEventListener("click", loadPage);
document.querySelector("#newCanvasButton").addEventListener("click", createNewCancas);
document.querySelector("#gallery").addEventListener("click",  contractHandler);
document.querySelector("#myCanvasButton").addEventListener("click", myCanvas);
document.querySelector("#search").addEventListener("click", searchCanvas);

// main process
async function loadPage(event){
    event.target.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`;
    event.target.disabled = true;
    await connectCeloWallet();
    mainNotification(`⚠️ artist royalty: ${await contract.methods.royalty().call()}%`);
    await getBalance();
    await getCanvases();
    event.target.innerHTML = "connect";
    event.target.disabled = false;
    coverDismiss();
}

//init
async function connectCeloWallet() {
    if (window.celo) {
        coverNotification("⚠️ Please approve this DApp to use it.");
      try {
        await window.celo.enable();
  
        const web3 = new Web3(window.celo);
        kit = newKitFromWeb3(web3);

        const accounts = await kit.web3.eth.getAccounts();
        kit.defaultAccount = accounts[0];
  
        contract = new kit.web3.eth.Contract(anypixelsAbi, APContractAddress);

      } catch (error) {
        coverNotification(`⚠️ ${error}.`);
      }
    } else {
      coverNotification("⚠️ Please install the CeloExtensionWallet.");
    }
}

async function getBalance() {
    const totalBalance = await kit.getTotalBalance(kit.defaultAccount);
    const cUSDBalance = totalBalance.cUSD.shiftedBy(-ERC20_DECIMALS).toFixed(2);
    document.querySelector("#balance").textContent = cUSDBalance;
  }


async function getCanvases() {
    const _canvasesLength = await contract.methods.getCanvasLength().call();
    const _canvases = [];
    
    for (let i = 0; i < _canvasesLength; i++) {
        let _canvas = new Promise(async (resolve, reject) => {
            let p = await contract.methods.readCanvas(i).call();
            resolve({
                index: i,
                name: p[0],
                owner: p[1],
                pixels: p[2],
                artist: p[3],
                description: p[4],
                price: new BigNumber(p[5]),
                display: "block",
                });
            });
        _canvases.push(_canvas);
    }
    canvases = await Promise.all(_canvases);
    renderCanvases(canvases);
}


function renderCanvases(_canvases) {
    document.querySelector('#gallery').innerHTML = "";
    _canvases.forEach((_canvas) => {
        const newDiv = document.createElement("div");
        newDiv.className = "col-md-4";
        newDiv.innerHTML = canvasTemplate(_canvas);
        document.querySelector('#gallery').appendChild(newDiv);
    })
}

function canvasTemplate(_canvas) {
    return `
        <div class="card mb-4">
            <img class="card-img-top" src="${createImageURL(_canvas.pixels)}" alt="..." class="card-img">
            <div class="position-absolute top-0 start-0 bg-warning mt-4 py-1 rounded-end">
                ${_canvas.price.shiftedBy(-ERC20_DECIMALS).toFixed(2)} cUSD
            </div>

            <div class="card-body text-left p-4 position-relative">
                <h2 class="card-title fs-4 fw-bold mt-2">${_canvas.name}</h2>
                <p class="card-text" >
                    ${_canvas.description}             
                </p>

                <p class="card-text mt-4">
                    <i class="bi bi-person"></i>
                    <span>Owner: ${_canvas.owner.slice(0,8)}</span>
                </p>
                <p class="card-text">
                    <i class="bi bi-pencil"></i>
                    <span>Artist: ${_canvas.artist.slice(0,8)}</span>
                </p>
                <div class="d-grid gap-2">
                    ${_canvas.owner === kit.defaultAccount ? 
                        `<input type="number" id="newPrice${_canvas.index}" class="form-control" placeholder="newPrice" /> 
                        <a class="btn btn-lg btn-light priceBtn fs-6 p-3" id=${_canvas.index}>
                            Set Price
                        </a>`
                        :
                        `<a class="btn btn-lg btn-outline-dark buyBtn fs-6 p-3" id=${_canvas.index}>
                            Buy
                        </a>`
                    }
                </div>
            </div>
        </div>`;
}

function createImageURL(pixels) {
    let canvas = document.createElement("canvas");
    canvas.width = canvas.height = 240;

    let cc = canvas.getContext('2d');

    for(let i = 0; i < 8; i++) {
        for(let j = 0; j < 8; j++) {
            let pixelsIndex = Math.floor((i * 8 + j) / 32) * 3;
            let colorIndex = (i * 8 + j) % 32 * 2 + 2;
            cc.fillStyle = "#" + pixels[pixelsIndex].slice(colorIndex,colorIndex + 2) + pixels[pixelsIndex + 1].slice(colorIndex,colorIndex + 2) + pixels[pixelsIndex + 2].slice(colorIndex,colorIndex + 2);
            cc.fillRect(j * 30, i * 30, 30, 30);
        }
    }
    return canvas.toDataURL();
}


function coverDismiss(){
    document.querySelector("#cover").style.transform = "translateY(-100vh)";
}

//contract interaction
async function createNewCancas() {
    const params = [
      document.getElementById("newCanvasName").value,
      getPixelData(),
      document.getElementById("newCanvasDescription").value,
      new BigNumber(document.getElementById("newCanvasPrice").value)
        .shiftedBy(ERC20_DECIMALS)
        .toString()
    ];
    mainNotification(`⌛ Adding "${params[0]}"...`);
    try {
        const result = await contract.methods
          .createCanvas(...params)
          .send({ from: kit.defaultAccount });
        mainNotification(`🎉 You successfully added "${params[0]}".`);
      } catch (error) {
        mainNotification(`⚠️ ${error}.`);
      }
    getCanvases();
}

function getPixelData(){
    let _data = ["0x","0x","0x","0x","0x","0x"];

    Array.from(document.querySelectorAll(".block")).forEach((_block, _index) => {
        const _color = _block.style.backgroundColor.match(/\d{1,3}/g);
        console.log(_color);
        let baseIndex = Math.floor(_index / 32) * 3;
        _data[baseIndex] += (parseInt(_color[0])+256).toString(16).slice(1,3);
        _data[baseIndex + 1] += (parseInt(_color[1])+256).toString(16).slice(1,3);
        _data[baseIndex + 2] += (parseInt(_color[2])+256).toString(16).slice(1,3);
    });
    console.log(_data);
    return _data;
}

async function approve(_price) {
    const cUSDContract = new kit.web3.eth.Contract(erc20Abi, cUSDContractAddress);
  
    const result = await cUSDContract.methods
      .approve(APContractAddress, _price)
      .send({ from: kit.defaultAccount });
    return result;
  }

async function contractHandler(event) {
    if (event.target.className.includes("buyBtn")) {
      const index = event.target.id;
      mainNotification("⌛ Waiting for payment approval...");
      try {
        await approve(canvases[index].price);
      } catch (error) {
        mainNotification(`⚠️ ${error}.`);
      }
      mainNotification(`⌛ Awaiting payment for "${canvases[index].name}"...`);
      try {
        const result = await contract.methods
          .buyCanvas(index)
          .send({ from: kit.defaultAccount });
        mainNotification(`🎉 You successfully bought "${canvases[index].name}".`);
        getCanvases();
        getBalance();
      } catch (error) {
        mainNotification(`⚠️ ${error}.`);
      }
    }
    else if(event.target.className.includes("priceBtn")){
      const index = event.target.id;
      const price = document.querySelector(`#newPrice${index}`).value;
      mainNotification(`⌛ Setting price for "${canvases[index].name}"...`);
      try {
        const result = await contract.methods
          .setPrice(index, new BigNumber(price).shiftedBy(ERC20_DECIMALS).toString())
          .send({ from: kit.defaultAccount });
        mainNotification(`🎉 You successfully set "${canvases[index].name}" to ${price} cUSD.`);
        getCanvases();
        getBalance();
      } catch (error) {
        mainNotification(`⚠️ ${error}.`);
      }
    }
}

//filter
function myCanvas(){
    mainNotification("💡 Click Search back to all canvases!");
    const newCanvases = canvases.filter(_canvas => _canvas.owner === kit.defaultAccount);
    renderCanvases(newCanvases);
}

function searchCanvas(){
    mainNotification("💡 Click Search back to all canvases!");
    const _owner = document.querySelector("#owner").value;
    const _artist = document.querySelector("#artist").value;
    document.querySelector("#owner").value = "";
    document.querySelector("#artist").value = "";
    const newCanvases = canvases.filter(_canvas => (!_owner || _owner === _canvas.owner) && (!_artist || _artist === _canvas.artist));
    renderCanvases(newCanvases);
}


//Modal
function initModal(){
    const _canvas = document.querySelector(".wrapper");
    for(let i = 0; i < 8; i++){
        for(let j = 0; j < 8; j++){
            const block = document.createElement("div");
            block.className="block";
            block.style = `grid-row: ${i + 1}; grid-column: ${j + 1}; background-color: #f0f0f0; aspect-ratio: 1 / 1;`
            block.dataset.index = i * 8 + j;
            _canvas.appendChild(block);
            block.addEventListener("click", (event) => {
                event.target.style.backgroundColor = document.querySelector('#colorSelector').value;
            })
        }
    }

}

//notification
function coverNotification(_text){
    document.querySelector("#coverNotification").textContent = _text;
}
function mainNotification(_text){
    document.querySelector("#mainNotification").textContent = _text;
}