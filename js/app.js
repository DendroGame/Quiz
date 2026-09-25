/* ============================================================================
   DENDROLOGY QUIZ ENGINE (js/app.js)
   Full implementation: Interactive 3D Bud Scans (Spinzam), Modes,
   Input Styles, Typing, Keybinds, and Draggable Image Resizer.
============================================================================ */

let SPECIES = [];
let SPECIES_DATA = [];
let SPECIES_FAMILY = [];
let COMMON_TO_SCI = {};
let SCI_TO_COMMON = {};

const FAMILIES = [
  { num: 1, name: "Adoxaceae", count: 3 }, { num: 2, name: "Altingiaceae", count: 1 },
  { num: 3, name: "Anacardiaceae", count: 4 }, { num: 4, name: "Annonaceae", count: 1 },
  { num: 5, name: "Apocynaceae", count: 1 }, { num: 6, name: "Aquifoliaceae", count: 3 },
  { num: 7, name: "Araliaceae", count: 3 }, { num: 8, name: "Berberidaceae", count: 1 },
  { num: 9, name: "Betulaceae", count: 11 }, { num: 10, name: "Bignoniaceae", count: 1 },
  { num: 11, name: "Caesalpiniaceae", count: 3 }, { num: 12, name: "Cannabaceae", count: 1 },
  { num: 13, name: "Caprifoliaceae", count: 2 }, { num: 14, name: "Celastraceae", count: 2 },
  { num: 15, name: "Cornaceae", count: 5 }, { num: 16, name: "Cupressaceae", count: 4 },
  { num: 17, name: "Ebenaceae", count: 1 }, { num: 18, name: "Ericaceae", count: 9 },
  { num: 19, name: "Fabaceae", count: 5 }, { num: 20, name: "Fagaceae", count: 17 },
  { num: 21, name: "Ginkgoaceae", count: 1 }, { num: 22, name: "Hamamelidaceae", count: 1 },
  { num: 23, name: "Juglandaceae", count: 7 }, { num: 24, name: "Lauraceae", count: 2 },
  { num: 25, name: "Lythraceae", count: 1 }, { num: 26, name: "Magnoliaceae", count: 4 },
  { num: 27, name: "Mimosaceae", count: 1 }, { num: 28, name: "Moraceae", count: 2 },
  { num: 29, name: "Nyssaceae", count: 1 }, { num: 30, name: "Oleaceae", count: 3 },
  { num: 32, name: "Paulowniaceae", count: 1 }, { num: 33, name: "Pinaceae", count: 16 },
  { num: 34, name: "Platanaceae", count: 1 }, { num: 35, name: "Rosaceae", count: 14 },
  { num: 36, name: "Salicaceae", count: 7 }, { num: 37, name: "Sapindaceae", count: 10 },
  { num: 38, name: "Simaroubaceae", count: 1 }, { num: 39, name: "Taxaceae", count: 1 },
  { num: 40, name: "Tiliaceae", count: 2 }, { num: 41, name: "Ulmaceae", count: 3 },
  { num: 42, name: "Vitaceae", count: 2 }, { num: 43, name: "Grossulariaceae", count: 1 },
  { num: 44, name: "Myricaceae", count: 1 }, { num: 45, name: "Hydrangeaceae", count: 1 },
  { num: 46, name: "Smilacaceae", count: 1 }, { num: 47, name: "Staphyleaceae", count: 1 },
  { num: 48, name: "Thymelaeaceae", count: 1 }, { num: 49, name: "Elaeagnaceae", count: 1 },
  { num: 50, name: "Polygonaceae", count: 1 }
];

const QUIZ_TEST_1_SCI = ["asimina triloba","ilex opaca","robinia pseudoacacia","juglans nigra","sassafras albidum","lindera benzoin","liriodendron tulipifera","fraxinus americana","paulownia tomentosa","pinus strobus","tsuga canadensis","platanus occidentalis","acer saccharum","acer negundo","aesculus flava","parthenocissus quinquefolia","toxicodendron radicans","carpinus caroliniana","elaeagnus umbellate","reynoutria japonica"];
const QUIZ_TEST_2_SCI = ["cercis canadensis","quercus alba","quercus montana","quercus coccinea","quercus marilandica","prunus serotina","pyrus calleryana","acer platanoides","ailanthus altissima","tilia americana"];
const QUIZ_TEST_3_SCI = ["quercus rubra","magnolia acuminata","acer pensylvanicum","cornus florida","acer rubrum","quercus velutina","smilax spp.","carya cordiformis","berbis spp."];
const QUIZ_TEST_4_SCI = ["nyssa sylvatica","fagus grandifolia","pinus rigida","pinus virginiana","oxydendrum arboreum","quercus falcata","juniperus virginiana","albizia julibrissin","quercus stellata","diospyros virginiana"];
const QUIZ_TEST_5_SCI = ["malus pumila","pinus taeda","quercus phellos","hedera helix","catalpa speciosa","cornus kousa","carya glabra var.glabra","fraxinus pennsylvanica","rubus phoenicolasius","ulmus rubra","rosa multiflora","cupressocyparis leylandii","acer saccharinum"];

const SPECIES_INFO = {
  'abies balsamea': { form: 'tree', leaf: 'evergreen', zones: '3–5', range: 'NE. U.S. & Canada', notes: 'balsam fir', invasive: false },
  'acer negundo': { form: 'tree', leaf: 'deciduous', zones: '2–9', range: 'most of U.S. & S. Canada', notes: 'boxelder', invasive: false },
  'acer nigrum': { form: 'tree', leaf: 'deciduous', zones: '4–8', range: 'NE. & C. U.S.', notes: 'black maple', invasive: false },
  'acer palmatum': { form: 'tree / shrub', leaf: 'deciduous', zones: '5–8', range: 'E. Asia (planted)', notes: 'Japanese maple', invasive: false },
  'acer pensylvanicum': { form: 'tree', leaf: 'deciduous', zones: '3–7', range: 'NE. U.S. & Appalachians', notes: 'striped bark', invasive: false },
  'acer platanoides': { form: 'tree', leaf: 'deciduous', zones: '3–7', range: 'Europe (invasive in NE. U.S.)', notes: 'Norway maple', invasive: true },
  'acer rubrum': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'E. North America', notes: 'red maple', invasive: false },
  'acer saccharinum': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'E. North America', notes: 'silver maple', invasive: false },
  'acer saccharum': { form: 'tree', leaf: 'deciduous', zones: '3–8', range: 'E. North America', notes: 'sugar maple', invasive: false },
  'aesculus flava': { form: 'tree', leaf: 'deciduous', zones: '4–8', range: 'Appalachians & Ohio Valley', notes: 'yellow buckeye', invasive: false },
  'aesculus hippocastanum': { form: 'tree', leaf: 'deciduous', zones: '4–7', range: 'Balkans (planted)', notes: 'horse chestnut', invasive: false },
  'ailanthus altissima': { form: 'tree', leaf: 'deciduous', zones: '4–8', range: 'China (invasive)', notes: 'tree-of-heaven', invasive: true },
  'albizia julibrissin': { form: 'tree', leaf: 'deciduous', zones: '6–9', range: 'Asia (naturalized)', notes: 'mimosa', invasive: true },
  'alnus serrulata': { form: 'shrub / small tree', leaf: 'deciduous', zones: '4–9', range: 'E. U.S. wetlands', notes: 'brookside alder', invasive: false },
  'amelanchier arborea': { form: 'tree / shrub', leaf: 'deciduous', zones: '4–9', range: 'E. North America', notes: 'serviceberry', invasive: false },
  'aralia spinosa': { form: 'shrub / small tree', leaf: 'deciduous', zones: '4–9', range: 'E. & S. U.S.', notes: 'Hercules-club', invasive: false },
  'asimina triloba': { form: 'tree / shrub', leaf: 'deciduous', zones: '5–9', range: 'E. U.S.', notes: 'pawpaw', invasive: false },
  'berbis spp.': { form: 'shrub', leaf: 'deciduous', zones: '4–8', range: 'Eurasian', notes: 'barberry', invasive: true },
  'betula alleghaniensis': { form: 'tree', leaf: 'deciduous', zones: '3–7', range: 'NE. U.S. & E. Canada', notes: 'yellow birch', invasive: false },
  'betula lenta': { form: 'tree', leaf: 'deciduous', zones: '3–8', range: 'Appalachians & NE. U.S.', notes: 'black birch', invasive: false },
  'betula nigra': { form: 'tree', leaf: 'deciduous', zones: '4–9', range: 'E. U.S. floodplains', notes: 'river birch', invasive: false },
  'betula papyrifera': { form: 'tree', leaf: 'deciduous', zones: '2–7', range: 'N. North America', notes: 'paper birch', invasive: false },
  'betula pendula': { form: 'tree', leaf: 'deciduous', zones: '2–7', range: 'Europe & Asia (planted)', notes: 'European white birch', invasive: false },
  'betula populifolia': { form: 'tree', leaf: 'deciduous', zones: '3–6', range: 'NE. U.S. & SE. Canada', notes: 'gray birch', invasive: false },
  'carpinus caroliniana': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'E. North America', notes: 'musclewood', invasive: false },
  'carya cordiformis': { form: 'tree', leaf: 'deciduous', zones: '4–9', range: 'E. North America', notes: 'bitternut hickory', invasive: false },
  'carya glabra var.glabra': { form: 'tree', leaf: 'deciduous', zones: '4–9', range: 'E. U.S.', notes: 'pignut hickory', invasive: false },
  'carya ovalis': { form: 'tree', leaf: 'deciduous', zones: '5–8', range: 'E. U.S.', notes: 'red hickory', invasive: false },
  'carya ovata': { form: 'tree', leaf: 'deciduous', zones: '4–8', range: 'E. North America', notes: 'shagbark hickory', invasive: false },
  'carya tomentosa': { form: 'tree', leaf: 'deciduous', zones: '4–9', range: 'E. U.S.', notes: 'mockernut hickory', invasive: false },
  'castanea dentata': { form: 'tree', leaf: 'deciduous', zones: '4–8', range: 'E. U.S.', notes: 'American chestnut', invasive: false },
  'castanea pumila': { form: 'shrub / small tree', leaf: 'deciduous', zones: '5–9', range: 'SE. U.S.', notes: 'Allegheny chinkapin', invasive: false },
  'catalpa speciosa': { form: 'tree', leaf: 'deciduous', zones: '4–8', range: 'C. U.S.', notes: 'northern catalpa', invasive: false },
  'celastrus orbiculatus': { form: 'vine', leaf: 'deciduous', zones: '4–8', range: 'Asia (invasive E. U.S.)', notes: 'oriental bittersweet', invasive: true },
  'celtis occidentalis': { form: 'tree', leaf: 'deciduous', zones: '2–9', range: 'E. & C. North America', notes: 'hackberry', invasive: false },
  'cercis canadensis': { form: 'tree', leaf: 'deciduous', zones: '4–9', range: 'E. U.S.', notes: 'eastern redbud', invasive: false },
  'chimaphila maculata': { form: 'groundcover', leaf: 'evergreen', zones: '4–7', range: 'E. North America forests', notes: 'striped pipsissewa', invasive: false },
  'chionanthus virginicus': { form: 'tree / shrub', leaf: 'deciduous', zones: '3–9', range: 'E. U.S.', notes: 'fringe tree', invasive: false },
  'cladrastis lutea': { form: 'tree', leaf: 'deciduous', zones: '4–8', range: 'SE. U.S.', notes: 'yellow wood', invasive: false },
  'comptonia peregrina': { form: 'shrub', leaf: 'deciduous', zones: '2–6', range: 'E. North America', notes: 'sweet fern', invasive: false },
  'cornus alternifolia': { form: 'tree / shrub', leaf: 'deciduous', zones: '3–7', range: 'E. North America', notes: 'alternate-leaf dogwood', invasive: false },
  'cornus florida': { form: 'tree', leaf: 'deciduous', zones: '5–9', range: 'E. U.S.', notes: 'flowering dogwood', invasive: false },
  'cornus kousa': { form: 'tree', leaf: 'deciduous', zones: '5–8', range: 'E. Asia (planted)', notes: 'kousa dogwood', invasive: false },
  'cornus obliqua': { form: 'shrub', leaf: 'deciduous', zones: '4–8', range: 'E. North America wetlands', notes: 'silky dogwood', invasive: false },
  'cornus stolonifera': { form: 'shrub', leaf: 'deciduous', zones: '2–7', range: 'N. North America', notes: 'red-osier dogwood', invasive: false },
  'corylus americana': { form: 'shrub', leaf: 'deciduous', zones: '4–9', range: 'E. & C. North America', notes: 'American hazelnut', invasive: false },
  'corylus cornuta': { form: 'shrub', leaf: 'deciduous', zones: '3–8', range: 'N. North America', notes: 'beaked hazel', invasive: false },
  'crataegus spp.': { form: 'tree / shrub', leaf: 'deciduous', zones: '3–8', range: 'N. Hemisphere', notes: 'hawthorn', invasive: false },
  'cupressocyparis leylandii': { form: 'tree', leaf: 'evergreen', zones: '6–10', range: 'hybrid (planted)', notes: 'Leyland cypress', invasive: false },
  'diospyros virginiana': { form: 'tree', leaf: 'deciduous', zones: '4–9', range: 'E. & S. U.S.', notes: 'common persimmon', invasive: false },
  'dirca palustris': { form: 'shrub', leaf: 'deciduous', zones: '3–9', range: 'E. North America', notes: 'leatherwood', invasive: false },
  'elaeagnus umbellate': { form: 'shrub', leaf: 'deciduous', zones: '3–8', range: 'Asia (invasive)', notes: 'autumn-olive', invasive: true },
  'euonymus americana': { form: 'shrub', leaf: 'deciduous', zones: '5–9', range: 'E. U.S.', notes: 'strawberry bush', invasive: false },
  'fagus grandifolia': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'E. North America', notes: 'American beech', invasive: false },
  'fraxinus americana': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'E. North America', notes: 'white ash', invasive: false },
  'fraxinus pennsylvanica': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'E. & C. North America', notes: 'green ash', invasive: false },
  'gaultheria procumbens': { form: 'groundcover', leaf: 'evergreen', zones: '3–8', range: 'E. North America', notes: 'teaberry', invasive: false },
  'gaylussacia spp.': { form: 'shrub', leaf: 'deciduous', zones: '3–8', range: 'E. North America', notes: 'huckleberry', invasive: false },
  'ginkgo biloba': { form: 'tree', leaf: 'deciduous', zones: '3–8', range: 'China (planted)', notes: 'ginkgo', invasive: false },
  'gleditsia triacanthos': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'C. U.S.', notes: 'honeylocust', invasive: false },
  'gleditsia triacanthos(var. inermis)': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'cultivar', notes: 'thornless honeylocust', invasive: false },
  'gymnocladus dioicus': { form: 'tree', leaf: 'deciduous', zones: '3–8', range: 'C. U.S.', notes: 'Kentucky coffee tree', invasive: false },
  'hamamelis virginiana': { form: 'shrub / small tree', leaf: 'deciduous', zones: '3–8', range: 'E. North America', notes: 'witch-hazel', invasive: false },
  'hedera helix': { form: 'vine', leaf: 'evergreen', zones: '5–11', range: 'Europe', notes: 'English ivy', invasive: true },
  'hydrangea arborescens': { form: 'shrub', leaf: 'deciduous', zones: '3–9', range: 'E. U.S.', notes: 'wild hydrangea', invasive: false },
  'ilex montana': { form: 'shrub / small tree', leaf: 'deciduous', zones: '5–7', range: 'Appalachians', notes: 'mountain holly', invasive: false },
  'ilex opaca': { form: 'tree', leaf: 'evergreen', zones: '5–9', range: 'E. U.S.', notes: 'American holly', invasive: false },
  'ilex verticillata': { form: 'shrub', leaf: 'deciduous', zones: '3–9', range: 'E. North America', notes: 'winterberry holly', invasive: false },
  'juglans cinerea': { form: 'tree', leaf: 'deciduous', zones: '3–7', range: 'NE. U.S. & SE. Canada', notes: 'butternut', invasive: false },
  'juglans nigra': { form: 'tree', leaf: 'deciduous', zones: '4–9', range: 'E. & C. U.S.', notes: 'black walnut', invasive: false },
  'juniperus virginiana': { form: 'tree', leaf: 'evergreen', zones: '2–9', range: 'E. & C. U.S.', notes: 'eastern redcedar', invasive: false },
  'kalmia latifolia': { form: 'shrub', leaf: 'evergreen', zones: '4–9', range: 'E. U.S.', notes: 'mountain-laurel', invasive: false },
  'lagerstroemia indica': { form: 'tree / shrub', leaf: 'deciduous', zones: '7–9', range: 'Asia (planted)', notes: 'crape myrtle', invasive: false },
  'larix spp.': { form: 'tree', leaf: 'deciduous conifer', zones: '2–5', range: 'N. Hemisphere', notes: 'larch', invasive: false },
  'lindera benzoin': { form: 'shrub', leaf: 'deciduous', zones: '4–9', range: 'E. U.S.', notes: 'spicebush', invasive: false },
  'liquidambar styraciflua': { form: 'tree', leaf: 'deciduous', zones: '5–9', range: 'SE. U.S.', notes: 'sweetgum', invasive: false },
  'liriodendron tulipifera': { form: 'tree', leaf: 'deciduous', zones: '4–9', range: 'E. U.S.', notes: 'yellow-poplar', invasive: false },
  'lonicera japonica': { form: 'vine', leaf: 'semi-evergreen', zones: '4–9', range: 'Asia', notes: 'Japanese honeysuckle', invasive: true },
  'maclura pomifera': { form: 'tree', leaf: 'deciduous', zones: '4–9', range: 'S.-C. U.S.', notes: 'osage-orange', invasive: false },
  'magnolia acuminata': { form: 'tree', leaf: 'deciduous', zones: '3–8', range: 'E. U.S.', notes: 'cucumbertree', invasive: false },
  'magnolia fraseri': { form: 'tree', leaf: 'deciduous', zones: '5–8', range: 'S. Appalachians', notes: 'Fraser magnolia', invasive: false },
  'magnolia grandiflora': { form: 'tree', leaf: 'evergreen', zones: '7–9', range: 'SE. U.S.', notes: 'southern magnolia', invasive: false },
  'malus pumila': { form: 'tree', leaf: 'deciduous', zones: '3–8', range: 'C. Asia (planted)', notes: 'common apple', invasive: false },
  'morus rubra': { form: 'tree', leaf: 'deciduous', zones: '4–8', range: 'E. U.S.', notes: 'red mulberry', invasive: false },
  'nyssa sylvatica': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'E. U.S.', notes: 'blackgum', invasive: false },
  'ostrya virginiana': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'E. North America', notes: 'ironwood', invasive: false },
  'oxydendrum arboreum': { form: 'tree', leaf: 'deciduous', zones: '5–9', range: 'SE. U.S.', notes: 'sourwood', invasive: false },
  'panax quinquefolius': { form: 'herb', leaf: 'deciduous', zones: '3–8', range: 'E. North America', notes: 'ginseng', invasive: false },
  'parthenocissus quinquefolia': { form: 'vine', leaf: 'deciduous', zones: '3–9', range: 'E. North America', notes: 'Virginia creeper', invasive: false },
  'paulownia tomentosa': { form: 'tree', leaf: 'deciduous', zones: '5–9', range: 'China (naturalized)', notes: 'royal paulownia', invasive: true },
  'picea abies': { form: 'tree', leaf: 'evergreen', zones: '2–7', range: 'Europe (planted)', notes: 'Norway spruce', invasive: false },
  'picea glauca': { form: 'tree', leaf: 'evergreen', zones: '2–6', range: 'N. North America', notes: 'white spruce', invasive: false },
  'picea pungens': { form: 'tree', leaf: 'evergreen', zones: '2–7', range: 'Rocky Mountains', notes: 'blue spruce', invasive: false },
  'picea rubens': { form: 'tree', leaf: 'evergreen', zones: '2–5', range: 'NE. U.S. & Appalachians', notes: 'red spruce', invasive: false },
  'pieris floribunda': { form: 'shrub', leaf: 'evergreen', zones: '4–6', range: 'S. Appalachians', notes: 'mountain fetterbush', invasive: false },
  'pinus echinata': { form: 'tree', leaf: 'evergreen', zones: '6–9', range: 'SE. U.S.', notes: 'shortleaf pine', invasive: false },
  'pinus palustris': { form: 'tree', leaf: 'evergreen', zones: '7–9', range: 'SE. U.S.', notes: 'longleaf pine', invasive: false },
  'pinus pungens': { form: 'tree', leaf: 'evergreen', zones: '5–7', range: 'Appalachians', notes: 'Table Mountain pine', invasive: false },
  'pinus resinosa': { form: 'tree', leaf: 'evergreen', zones: '2–5', range: 'NE. U.S. & Canada', notes: 'red pine', invasive: false },
  'pinus rigida': { form: 'tree', leaf: 'evergreen', zones: '4–7', range: 'NE. U.S. & Appalachians', notes: 'pitch pine', invasive: false },
  'pinus strobus': { form: 'tree', leaf: 'evergreen', zones: '3–8', range: 'NE. U.S. & Canada', notes: 'eastern white pine', invasive: false },
  'pinus sylvestris': { form: 'tree', leaf: 'evergreen', zones: '2–7', range: 'Europe & Asia', notes: 'scotch pine', invasive: false },
  'pinus taeda': { form: 'tree', leaf: 'evergreen', zones: '6–9', range: 'SE. U.S.', notes: 'loblolly pine', invasive: false },
  'pinus virginiana': { form: 'tree', leaf: 'evergreen', zones: '4–8', range: 'E. U.S.', notes: 'Virginia pine', invasive: false },
  'platanus occidentalis': { form: 'tree', leaf: 'deciduous', zones: '4–9', range: 'E. North America', notes: 'American sycamore', invasive: false },
  'populus alba': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'Europe (planted)', notes: 'white poplar', invasive: true },
  'populus balsamifera': { form: 'tree', leaf: 'deciduous', zones: '2–5', range: 'N. North America', notes: 'balsam poplar', invasive: false },
  'populus grandidentata': { form: 'tree', leaf: 'deciduous', zones: '3–5', range: 'NE. U.S. & Canada', notes: 'bigtooth aspen', invasive: false },
  'populus nigra var. italica': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'cultivar', notes: 'Lombardy poplar', invasive: false },
  'populus tremuloides': { form: 'tree', leaf: 'deciduous', zones: '1–6', range: 'N. North America', notes: 'quaking aspen', invasive: false },
  'prunus avium': { form: 'tree', leaf: 'deciduous', zones: '5–8', range: 'Europe (planted)', notes: 'sweet cherry', invasive: false },
  'prunus pendula': { form: 'tree', leaf: 'deciduous', zones: '5–8', range: 'Japan (planted)', notes: 'weeping cherry', invasive: false },
  'prunus pensylvanica': { form: 'tree', leaf: 'deciduous', zones: '2–5', range: 'N. North America', notes: 'fire cherry', invasive: false },
  'prunus serotina': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'E. North America', notes: 'black cherry', invasive: false },
  'prunus virginiana': { form: 'shrub / small tree', leaf: 'deciduous', zones: '2–7', range: 'N. North America', notes: 'chokecherry', invasive: false },
  'pueraria montana': { form: 'vine', leaf: 'deciduous', zones: '5–10', range: 'Asia (invasive)', notes: 'kudzu', invasive: true },
  'pyrus calleryana': { form: 'tree', leaf: 'deciduous', zones: '5–9', range: 'China (invasive)', notes: 'Bradford pear', invasive: true },
  'quercus acutissima': { form: 'tree', leaf: 'deciduous', zones: '5–9', range: 'E. Asia (planted)', notes: 'sawtooth oak', invasive: false },
  'quercus alba': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'E. North America', notes: 'white oak', invasive: false },
  'quercus coccinea': { form: 'tree', leaf: 'deciduous', zones: '4–9', range: 'E. U.S.', notes: 'scarlet oak', invasive: false },
  'quercus falcata': { form: 'tree', leaf: 'deciduous', zones: '6–9', range: 'SE. U.S.', notes: 'southern red oak', invasive: false },
  'quercus ilicifolia': { form: 'shrub / small tree', leaf: 'deciduous', zones: '4–7', range: 'NE. U.S.', notes: 'bear oak', invasive: false },
  'quercus macrocarpa': { form: 'tree', leaf: 'deciduous', zones: '3–8', range: 'C. North America', notes: 'bur oak', invasive: false },
  'quercus marilandica': { form: 'tree', leaf: 'deciduous', zones: '5–9', range: 'E. & C. U.S.', notes: 'blackjack oak', invasive: false },
  'quercus michauxii': { form: 'tree', leaf: 'deciduous', zones: '5–9', range: 'SE. U.S.', notes: 'swamp chestnut oak', invasive: false },
  'quercus montana': { form: 'tree', leaf: 'deciduous', zones: '4–8', range: 'Appalachians', notes: 'chestnut oak', invasive: false },
  'quercus palustris': { form: 'tree', leaf: 'deciduous', zones: '4–8', range: 'E. & C. U.S.', notes: 'pin oak', invasive: false },
  'quercus phellos': { form: 'tree', leaf: 'deciduous', zones: '5–9', range: 'SE. U.S.', notes: 'willow oak', invasive: false },
  'quercus rubra': { form: 'tree', leaf: 'deciduous', zones: '3–7', range: 'E. North America', notes: 'northern red oak', invasive: false },
  'quercus stellata': { form: 'tree', leaf: 'deciduous', zones: '5–9', range: 'E. & C. U.S.', notes: 'post oak', invasive: false },
  'quercus velutina': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'E. North America', notes: 'black oak', invasive: false },
  'reynoutria japonica': { form: 'herbaceous shrub', leaf: 'deciduous', zones: '4–8', range: 'Asia (invasive)', notes: 'Japanese knotweed', invasive: true },
  'rhododendron maximum': { form: 'shrub', leaf: 'evergreen', zones: '3–7', range: 'Appalachians', notes: 'rosebay rhododendron', invasive: false },
  'rhododendron spp.': { form: 'shrub', leaf: 'deciduous', zones: '4–8', range: 'E. North America', notes: 'wild azalea', invasive: false },
  'rhus copallina': { form: 'shrub / small tree', leaf: 'deciduous', zones: '4–9', range: 'E. & S. U.S.', notes: 'winged sumac', invasive: false },
  'rhus glabra': { form: 'shrub / small tree', leaf: 'deciduous', zones: '3–9', range: 'most of U.S.', notes: 'smooth sumac', invasive: false },
  'rhus typhina': { form: 'shrub / small tree', leaf: 'deciduous', zones: '3–8', range: 'E. North America', notes: 'staghorn sumac', invasive: false },
  'ribes spp.': { form: 'shrub', leaf: 'deciduous', zones: '3–7', range: 'North America', notes: 'gooseberry', invasive: false },
  'robinia pseudoacacia': { form: 'tree', leaf: 'deciduous', zones: '3–8', range: 'Appalachians', notes: 'black locust', invasive: false },
  'rosa multiflora': { form: 'shrub', leaf: 'deciduous', zones: '4–8', range: 'Asia (invasive)', notes: 'multiflora rose', invasive: true },
  'rubus allegheniensis': { form: 'shrub', leaf: 'deciduous', zones: '3–8', range: 'E. North America', notes: 'blackberry', invasive: false },
  'rubus occidentalis': { form: 'shrub', leaf: 'deciduous', zones: '3–8', range: 'E. North America', notes: 'black raspberry', invasive: false },
  'rubus phoenicolasius': { form: 'shrub', leaf: 'deciduous', zones: '4–8', range: 'Asia (naturalized)', notes: 'wine raspberry', invasive: true },
  'salix babylonica': { form: 'tree', leaf: 'deciduous', zones: '4–9', range: 'China (planted)', notes: 'weeping willow', invasive: false },
  'salix nigra': { form: 'tree', leaf: 'deciduous', zones: '2–8', range: 'E. North America', notes: 'black willow', invasive: false },
  'sambucus canadensis': { form: 'shrub', leaf: 'deciduous', zones: '3–9', range: 'E. North America', notes: 'common elderberry', invasive: false },
  'sassafras albidum': { form: 'tree', leaf: 'deciduous', zones: '4–9', range: 'E. U.S.', notes: 'sassafras', invasive: false },
  'smilax spp.': { form: 'vine', leaf: 'deciduous', zones: '4–9', range: 'E. North America', notes: 'greenbrier', invasive: false },
  'sorbus americana': { form: 'tree', leaf: 'deciduous', zones: '2–5', range: 'NE. U.S. & Canada', notes: 'mountain-ash', invasive: false },
  'staphylea trifolia': { form: 'shrub', leaf: 'deciduous', zones: '3–8', range: 'E. North America', notes: 'bladdernut', invasive: false },
  'symphoricarpos orbiculatus': { form: 'shrub', leaf: 'deciduous', zones: '2–8', range: 'E. & C. U.S.', notes: 'coralberry', invasive: false },
  'taxodium distichum var. distichum': { form: 'tree', leaf: 'deciduous conifer', zones: '4–10', range: 'SE. U.S.', notes: 'baldcypress', invasive: false },
  'taxus spp.': { form: 'shrub / tree', leaf: 'evergreen', zones: '4–7', range: 'N. Hemisphere', notes: 'yew', invasive: false },
  'thuja occidentalis': { form: 'tree', leaf: 'evergreen', zones: '2–7', range: 'NE. U.S. & Canada', notes: 'northern white-cedar', invasive: false },
  'tilia americana': { form: 'tree', leaf: 'deciduous', zones: '2–8', range: 'E. North America', notes: 'American basswood', invasive: false },
  'tilia cordata': { form: 'tree', leaf: 'deciduous', zones: '3–7', range: 'Europe (planted)', notes: 'littleleaf linden', invasive: false },
  'toxicodendron radicans': { form: 'vine / shrub', leaf: 'deciduous', zones: '3–10', range: 'E. & C. North America', notes: 'poison-ivy', invasive: false },
  'tsuga canadensis': { form: 'tree', leaf: 'evergreen', zones: '3–7', range: 'E. North America', notes: 'eastern hemlock', invasive: false },
  'ulmus americana': { form: 'tree', leaf: 'deciduous', zones: '2–9', range: 'E. North America', notes: 'American elm', invasive: false },
  'ulmus rubra': { form: 'tree', leaf: 'deciduous', zones: '3–9', range: 'E. & C. U.S.', notes: 'slippery elm', invasive: false },
  'vaccinium spp.': { form: 'shrub', leaf: 'deciduous', zones: '2–8', range: 'E. North America', notes: 'blueberry', invasive: false },
  'viburnum acerifolium': { form: 'shrub', leaf: 'deciduous', zones: '3–8', range: 'E. North America', notes: 'mapleleaf viburnum', invasive: false },
  'viburnum prunifolium': { form: 'shrub / small tree', leaf: 'deciduous', zones: '3–9', range: 'E. & C. North America', notes: 'blackhaw viburnum', invasive: false },
  'vinca minor': { form: 'groundcover vine', leaf: 'evergreen', zones: '4–9', range: 'Europe (naturalized)', notes: 'periwinkle', invasive: true },
  'vitis spp.': { form: 'vine', leaf: 'deciduous', zones: '3–9', range: 'E. North America', notes: 'wild grape', invasive: false },
  'wisteria spp.': { form: 'vine', leaf: 'deciduous', zones: '5–9', range: 'Asia / native', notes: 'wisteria', invasive: true },
  'zelkova serrata': { form: 'tree', leaf: 'deciduous', zones: '5–8', range: 'E. Asia (planted)', notes: 'Japanese zelkova', invasive: false }
};

const KEYBIND_DEFAULTS = {
  submit: 'Enter', next: 'Enter', space: ' ', cancel: 'Escape',
  hint: 'h', left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
  restart: 'r', redoMissed: 'Tab', home: 'Enter'
};
let keybinds = Object.assign({}, KEYBIND_DEFAULTS);
let kbHighlight = -1;
let keybindListening = null;

let TIME_LIMIT = 15;
let TOTAL = 10;
let preferredQuizLength = 10;
let NUM_CHOICES = 4;
let selectedSpecies = [];
let mode = 'sci-to-common';
let selectedModes = ['sci-to-common'];
let selectedStyles = ['quiz'];
let typeAnswerMode = false;
let score = 0;
let streak = 0;
let qIndex = 0;
let currentCorrect = '';
let currentPair = null;
let currentSpeciesObj = null;
let questions = [];
let missed = [];
let isUltimate = false;
let isGuest = false;
let playerName = '';
let timerId = null;
let timeLeft = TIME_LIMIT;
let answered = false;
let hintUsedThisQ = false;

let modeBtns, startScreen, quizScreen, endScreen, stats, promptEl, promptLabel;
let optionsEl, feedback, nextBtn, progressBar, timerBar, timerText, speciesImg;
let imgPlaceholder, imgLoading, imgCredit, spinBtn;

function familyNameForPair(pair) {
  if (!pair || !pair.length) return '';
  let idx = -1;
  for (let i = 0; i < SPECIES.length; i++) {
    if (SPECIES[i][0] === pair[0] && SPECIES[i][1] === pair[1]) { idx = i; break; }
  }
  if (idx < 0) return '';
  const num = SPECIES_FAMILY[idx];
  const f = FAMILIES.find(item => item.num === num);
  return f ? `${f.num}. ${f.name}` : String(num);
}

function keyLabel(k) {
  if (!k) return '—';
  if (k === ' ') return 'Space';
  if (k === 'ArrowLeft') return '←';
  if (k === 'ArrowRight') return '→';
  if (k === 'ArrowUp') return '↑';
  if (k === 'ArrowDown') return '↓';
  return k.length === 1 ? k.toUpperCase() : k;
}

function initImageResizer() {
  const handle = document.getElementById('resizeBar') || document.getElementById('imgResizeHandle');
  const wrap = document.getElementById('mediaViewer') || document.getElementById('imageWrap');
  if (!handle || !wrap) return;

  let startY, startH;
  function onPointerDown(e) {
    startY = e.clientY || e.touches[0].clientY;
    startH = wrap.offsetHeight;
    document.documentElement.addEventListener('pointermove', onPointerMove);
    document.documentElement.addEventListener('pointerup', onPointerUp);
    e.preventDefault();
  }
  function onPointerMove(e) {
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const newH = Math.max(80, Math.min(500, startH + (clientY - startY)));
    wrap.style.height = `${newH}px`;
    wrap.style.setProperty('--img-h', `${newH}px`);
  }
  function onPointerUp() {
    document.documentElement.removeEventListener('pointermove', onPointerMove);
    document.documentElement.removeEventListener('pointerup', onPointerUp);
  }
  handle.addEventListener('pointerdown', onPointerDown);
}

function clearKbHighlight() {
  kbHighlight = -1;
  document.querySelectorAll('.option').forEach(o => o.classList.remove('kb-focus'));
}

function setKbHighlight(idx) {
  const opts = Array.from(document.querySelectorAll('.option:not([disabled])'));
  if (!opts.length) return;
  if (idx < 0) idx = opts.length - 1;
  if (idx >= opts.length) idx = 0;
  clearKbHighlight();
  kbHighlight = idx;
  opts[kbHighlight].classList.add('kb-focus');
}

async function loadDataAndInit() {
  try {
    const res = await fetch('./data/species.json');
    SPECIES_DATA = await res.json();
    
    SPECIES = [];
    SPECIES_FAMILY = [];
    COMMON_TO_SCI = {};
    SCI_TO_COMMON = {};

    SPECIES_DATA.forEach(item => {
      SPECIES.push([item.common, item.scientific]);
      SPECIES_FAMILY.push(item.familyNum);
      COMMON_TO_SCI[item.common] = item.scientific;
      SCI_TO_COMMON[item.scientific] = item.common;
    });

    initUISelectors();
    initFamilySelect();
    initSettingsAndPanels();
    initImageResizer();
    renderKeybindList();
  } catch (err) {
    console.error("Failed loading species.json:", err);
  }
}

function initUISelectors() {
  modeBtns = document.querySelectorAll('#modeSelect .mode-btn');
  startScreen = document.getElementById('startScreen');
  quizScreen = document.getElementById('quizScreen');
  endScreen = document.getElementById('endScreen');
  stats = document.getElementById('stats');
  promptEl = document.getElementById('prompt');
  promptLabel = document.getElementById('promptLabel');
  optionsEl = document.getElementById('options');
  feedback = document.getElementById('feedback');
  nextBtn = document.getElementById('nextBtn');
  progressBar = document.getElementById('progressBar');
  timerBar = document.getElementById('timerBar');
  timerText = document.getElementById('timerText');
  speciesImg = document.getElementById('activePhoto') || document.getElementById('speciesImg');
  imgPlaceholder = document.getElementById('mediaFallback') || document.getElementById('imgPlaceholder');
  imgLoading = document.getElementById('mediaLoader') || document.getElementById('imgLoading');
  spinBtn = document.getElementById('spinzamBtn');
}

function initSettingsAndPanels() {
  document.querySelectorAll('#modeSelect .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const allModeBtns = document.querySelectorAll('#modeSelect .mode-btn');
      const isCurrentlyActive = btn.classList.contains('active');
      const activeCount = document.querySelectorAll('#modeSelect .mode-btn.active').length;

      if (isCurrentlyActive && activeCount <= 1) return;

      btn.classList.toggle('active');

      selectedModes = [];
      allModeBtns.forEach(b => {
        if (b.classList.contains('active')) selectedModes.push(b.dataset.mode);
      });
      mode = selectedModes[0];
      updateStartButtonLabel();
    });
  });

  const quizBtn = document.getElementById('playStyleQuiz');
  const typeBtn = document.getElementById('playStyleTyping');

  function togglePlayStyle(clickedBtn) {
    const isCurrentlyActive = clickedBtn.classList.contains('active');
    const activeCount = document.querySelectorAll('#playStyleSelect .mode-btn.active').length;

    if (isCurrentlyActive && activeCount <= 1) return;

    clickedBtn.classList.toggle('active');

    selectedStyles = [];
    if (quizBtn?.classList.contains('active')) selectedStyles.push('quiz');
    if (typeBtn?.classList.contains('active')) selectedStyles.push('typing');

    const typeSection = document.getElementById('typeModeSection');
    const hasTyping = selectedStyles.includes('typing');
    if (typeSection) typeSection.style.display = hasTyping ? 'block' : 'none';
  }

  quizBtn?.addEventListener('click', () => togglePlayStyle(quizBtn));
  typeBtn?.addEventListener('click', () => togglePlayStyle(typeBtn));

  document.getElementById('settingsBtn')?.addEventListener('click', () => {
    document.getElementById('settingsPanel')?.classList.remove('hidden');
  });
  document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
    document.getElementById('settingsPanel')?.classList.add('hidden');
  });

  document.getElementById('timeLimitSlider')?.addEventListener('input', (e) => {
    TIME_LIMIT = parseInt(e.target.value, 10);
    document.getElementById('timeLimitLabel').textContent = TIME_LIMIT + 's';
  });

  document.querySelectorAll('#countSelect .count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#countSelect .count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      TOTAL = parseInt(btn.dataset.count, 10);
      preferredQuizLength = TOTAL;
      updateStartButtonLabel();
    });
  });

  document.querySelectorAll('#choicesSelect .choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#choicesSelect .choice-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      NUM_CHOICES = parseInt(btn.dataset.choices, 10);
    });
  });

  document.getElementById('typeSubmitBtn')?.addEventListener('click', submitTypedAnswer);
  document.getElementById('typeAnswerInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitTypedAnswer();
  });

  nextBtn?.addEventListener('click', nextQuestion);
  document.getElementById('startOverBtn')?.addEventListener('click', () => window.startQuiz(isUltimate ? 'ultimate' : isGuest));
  document.getElementById('homeBtn')?.addEventListener('click', () => {
    endScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
  });

  document.getElementById('cancelQuizBtn')?.addEventListener('click', () => {
    if (confirm('Leave quiz? Progress will be lost.')) {
      stopTimer();
      quizScreen.classList.add('hidden');
      stats.classList.add('hidden');
      startScreen.classList.remove('hidden');
      document.body.classList.remove('in-quiz');
    }
  });
}

function renderKeybindList() {
  const container = document.getElementById('keybindList');
  if (!container) return;
  container.innerHTML = '';

  const meta = [
    { id: 'submit', label: 'Submit / confirm selection' },
    { id: 'next', label: 'Next question' },
    { id: 'hint', label: 'Reveal photo' },
    { id: 'left', label: 'Highlight left / prev' },
    { id: 'right', label: 'Highlight right / next' }
  ];

  meta.forEach(item => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);';
    row.innerHTML = `<span style="font-size:0.85rem;">${item.label}</span>
      <button type="button" class="mode-btn" style="padding:4px 10px;min-width:60px;">${keyLabel(keybinds[item.id])}</button>`;
    
    const btn = row.querySelector('button');
    btn.addEventListener('click', () => {
      btn.textContent = '…';
      keybindListening = item.id;
    });
    container.appendChild(row);
  });
}

document.addEventListener('keydown', (e) => {
  if (keybindListening) {
    e.preventDefault();
    if (e.key !== 'Escape') keybinds[keybindListening] = e.key;
    keybindListening = null;
    renderKeybindList();
    return;
  }

  if (quizScreen && !quizScreen.classList.contains('hidden')) {
    if (e.key === keybinds.hint && !hintUsedThisQ) {
      hintUsedThisQ = true;
      revealImage();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      setKbHighlight(kbHighlight - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      setKbHighlight(kbHighlight + 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (answered) {
        nextQuestion();
      } else if (typeAnswerMode) {
        submitTypedAnswer();
      } else if (kbHighlight >= 0) {
        const opts = document.querySelectorAll('.option');
        if (opts[kbHighlight]) opts[kbHighlight].click();
      }
    }
  }
});

function initFamilySelect() {
  const list = document.getElementById('familyCheckList');
  const summary = document.getElementById('familySummary');
  if (!list) return;
  list.innerHTML = '';

  const indicesByFam = {};
  for (let i = 0; i < SPECIES.length; i++) {
    const n = SPECIES_FAMILY[i];
    if (!indicesByFam[n]) indicesByFam[n] = [];
    indicesByFam[n].push(i);
  }

  function updateSummary() {
    if (!summary) return;
    summary.textContent = !selectedSpecies.length
      ? `All species (${SPECIES.length})`
      : `${selectedSpecies.length} species selected`;
    updateStartButtonLabel();
  }

  function setSelected(indices) {
    selectedSpecies = indices.slice().sort((a, b) => a - b);
    const set = new Set(selectedSpecies);
    list.querySelectorAll('input.species-cb').forEach(cb => {
      cb.checked = set.has(parseInt(cb.dataset.idx, 10));
    });
    list.querySelectorAll('input.family-cb').forEach(cb => {
      const nums = indicesByFam[parseInt(cb.dataset.fam, 10)] || [];
      const on = nums.filter(i => set.has(i)).length;
      cb.checked = nums.length > 0 && on === nums.length;
      cb.indeterminate = on > 0 && on < nums.length;
    });
    updateSummary();
  }

  FAMILIES.forEach(f => {
    const idxs = indicesByFam[f.num] || [];
    const block = document.createElement('div');
    block.className = 'family-block';
    block.innerHTML = `
      <div class="family-block-head">
        <input type="checkbox" class="family-cb" data-fam="${f.num}">
        <span style="flex:1;cursor:pointer;">${f.num}. ${f.name} (${f.count})</span>
        <button type="button" class="family-expand">Species</button>
      </div>
      <div class="family-species-list"></div>
    `;

    const spList = block.querySelector('.family-species-list');
    idxs.forEach(si => {
      const pair = SPECIES[si];
      const lab = document.createElement('label');
      lab.className = 'species-check-item';
      lab.innerHTML = `<input type="checkbox" class="species-cb" data-idx="${si}">
                       <span>${pair[0]} — ${pair[1]}</span>`;
      spList.appendChild(lab);
    });

    const famCb = block.querySelector('.family-cb');
    famCb.addEventListener('change', () => {
      const set = new Set(selectedSpecies);
      idxs.forEach(i => famCb.checked ? set.add(i) : set.delete(i));
      setSelected([...set]);
    });

    block.querySelector('.family-expand').addEventListener('click', (e) => {
      spList.classList.toggle('open');
      e.target.textContent = spList.classList.contains('open') ? 'Hide' : 'Species';
    });

    spList.querySelectorAll('.species-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const idx = parseInt(cb.dataset.idx, 10);
        const set = new Set(selectedSpecies);
        cb.checked ? set.add(idx) : set.delete(idx);
        setSelected([...set]);
      });
    });

    list.appendChild(block);
  });

  document.getElementById('familyAllBtn')?.addEventListener('click', () => setSelected([]));

  const presets = [
    { id: 'quizTest1Toggle', sci: QUIZ_TEST_1_SCI },
    { id: 'quizTest2Toggle', sci: QUIZ_TEST_2_SCI },
    { id: 'quizTest3Toggle', sci: QUIZ_TEST_3_SCI },
    { id: 'quizTest4Toggle', sci: QUIZ_TEST_4_SCI },
    { id: 'quizTest5Toggle', sci: QUIZ_TEST_5_SCI }
  ];

  presets.forEach(p => {
    document.getElementById(p.id)?.addEventListener('change', () => {
      const want = new Set();
      presets.forEach(pr => {
        if (document.getElementById(pr.id)?.checked) {
          pr.sci.forEach(s => want.add(s.toLowerCase().trim()));
        }
      });
      if (want.size > 0) {
        const matches = [];
        SPECIES.forEach((pair, idx) => {
          if (want.has(pair[1].toLowerCase().trim())) matches.push(idx);
        });
        setSelected(matches);
      }
    });
  });

  updateSummary();
}

function updateStartButtonLabel() {
  const btn = document.getElementById('startBtn');
  if (btn) btn.textContent = `Start ${TOTAL}-question quiz`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickQuestions() {
  const pool = selectedSpecies.length ? selectedSpecies.map(i => SPECIES[i]) : SPECIES.slice();
  const out = [];
  let bag = shuffle(pool);
  while (out.length < TOTAL && bag.length) out.push(bag.pop());
  while (out.length < TOTAL) {
    if (!bag.length) bag = shuffle(pool);
    out.push(bag.pop());
  }
  return out;
}

window.startQuiz = function(guestOrUltimate) {
  isGuest = guestOrUltimate === true;
  isUltimate = guestOrUltimate === 'ultimate';
  playerName = document.getElementById('playerName')?.value.trim() || 'Guest';

  questions = pickQuestions();
  TOTAL = questions.length;
  qIndex = 0;
  score = 0;
  streak = 0;
  missed = [];

  startScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  quizScreen.classList.remove('hidden');
  stats.classList.remove('hidden');
  document.body.classList.add('in-quiz');

  showQuestion();
};

function showQuestion() {
  feedback.classList.add('hidden');
  nextBtn.classList.add('hidden');
  optionsEl.innerHTML = '';
  answered = false;
  hintUsedThisQ = false;
  clearKbHighlight();

  const currentMode = selectedModes[Math.floor(Math.random() * selectedModes.length)] || 'sci-to-common';
  const currentStyle = selectedStyles[Math.floor(Math.random() * selectedStyles.length)] || 'quiz';
  mode = currentMode;
  typeAnswerMode = (currentStyle === 'typing' && mode !== 'flash');

  const pair = questions[qIndex];
  currentPair = pair;
  currentSpeciesObj = SPECIES_DATA.find(s => s.scientific.toLowerCase() === pair[1].toLowerCase()) || null;

  if (mode === 'common-to-sci') {
    promptLabel.textContent = 'Scientific name';
    promptEl.textContent = pair[0];
    currentCorrect = pair[1];
  } else if (mode === 'family') {
    promptLabel.textContent = 'What family?';
    promptEl.textContent = `${pair[0]} (${pair[1]})`;
    currentCorrect = familyNameForPair(pair);
  } else {
    promptLabel.textContent = 'Common name';
    promptEl.textContent = pair[1];
    currentCorrect = pair[0];
  }

  document.getElementById('qNum').textContent = qIndex + 1;
  document.getElementById('totalQ').textContent = TOTAL;
  progressBar.style.width = ((qIndex / TOTAL) * 100) + '%';

  // --- 3D BUD SCAN VIEWER LOGIC ---
  const stage = document.getElementById('imageStage') || document.getElementById('imageWrap');
  if (spinBtn) {
    if (currentSpeciesObj && currentSpeciesObj.spinzam_url) {
      spinBtn.classList.remove('hidden');
      spinBtn.onclick = () => {
        if (stage) {
          stage.innerHTML = `
            <iframe src="${currentSpeciesObj.spinzam_url}" 
                    width="100%" 
                    height="100%" 
                    frameborder="0" 
                    scrolling="no" 
                    style="border-radius:12px; border:none; width:100%; min-height:220px;" 
                    allowfullscreen>
            </iframe>`;
        }
      };
    } else {
      spinBtn.classList.add('hidden');
    }
  }

  const typeArea = document.getElementById('typeAnswerArea');
  const typeInput = document.getElementById('typeAnswerInput');

  if (typeAnswerMode) {
    optionsEl.classList.add('hidden');
    typeArea?.classList.remove('hidden');
    if (typeInput) {
      typeInput.value = '';
      typeInput.disabled = false;
      setTimeout(() => typeInput.focus(), 50);
    }
  } else {
    typeArea?.classList.add('hidden');
    optionsEl.classList.remove('hidden');

    let choices = [currentCorrect];
    if (mode === 'family') {
      const famPool = FAMILIES.map(f => `${f.num}. ${f.name}`).filter(f => f !== currentCorrect);
      shuffle(famPool).slice(0, NUM_CHOICES - 1).forEach(c => choices.push(c));
    } else {
      const pool = SPECIES.map(p => (mode === 'common-to-sci' ? p[1] : p[0])).filter(n => n !== currentCorrect);
      shuffle(pool).slice(0, NUM_CHOICES - 1).forEach(c => choices.push(c));
    }

    shuffle(choices).forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option';
      btn.textContent = opt;
      btn.addEventListener('click', () => selectAnswer(btn, opt));
      optionsEl.appendChild(btn);
    });
  }

  loadPhoto(pair[1]);
  startTimer();
}

function submitTypedAnswer() {
  if (answered) return;
  const input = document.getElementById('typeAnswerInput');
  const typed = (input?.value || '').trim();
  const ok = (typed.toLowerCase() === currentCorrect.toLowerCase()) || 
             (mode === 'family' && typed.toLowerCase().includes(currentCorrect.toLowerCase().split('. ')[1] || ''));

  selectAnswer(document.createElement('div'), ok ? currentCorrect : typed);
}

function selectAnswer(btn, chosen) {
  if (answered) return;
  answered = true;
  stopTimer();

  optionsEl.querySelectorAll('.option').forEach(o => o.disabled = true);
  const correct = chosen.toLowerCase() === currentCorrect.toLowerCase();

  if (correct) {
    btn.classList.add('correct');
    score++;
    streak++;
    feedback.textContent = '✓ Correct!';
    feedback.className = 'feedback correct';
  } else {
    btn.classList.add('wrong');
    streak = 0;
    missed.push(currentPair);
    if (isUltimate) questions.push(currentPair);
    optionsEl.querySelectorAll('.option').forEach(o => {
      if (o.textContent.includes(currentCorrect)) o.classList.add('correct');
    });
    feedback.textContent = `✗ Wrong — Correct: ${currentCorrect}`;
    feedback.className = 'feedback wrong';
  }

  feedback.classList.remove('hidden');
  revealImage();
  nextBtn.classList.remove('hidden');
  document.getElementById('score').textContent = score;
  document.getElementById('streak').textContent = streak;
}

function nextQuestion() {
  qIndex++;
  if (qIndex < questions.length) {
    showQuestion();
  } else {
    endQuiz();
  }
}

function endQuiz() {
  stopTimer();
  quizScreen.classList.add('hidden');
  stats.classList.add('hidden');
  endScreen.classList.remove('hidden');
  document.body.classList.remove('in-quiz');
  document.getElementById('endMsg').textContent = `Final Score: ${score}/${TOTAL} (${Math.round((score / TOTAL) * 100)}%)`;
}

function updateTimerDisplay() {
  if (!timerText || !timerBar) return;
  timerText.textContent = timeLeft;
  timerBar.style.width = (timeLeft / TIME_LIMIT * 100) + '%';
}

function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
}

function startTimer() {
  stopTimer();
  timeLeft = TIME_LIMIT;
  updateTimerDisplay();
  timerId = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      stopTimer();
      if (!answered) selectAnswer(document.createElement('div'), '');
    }
  }, 1000);
}

async function loadPhoto(sciName) {
  const stage = document.getElementById('imageStage') || document.getElementById('imageWrap');
  if (stage && !stage.querySelector('img')) {
    stage.innerHTML = `
      <img id="activePhoto" alt="Diagnostic specimen" class="specimen-img hidden">
      <div id="mediaLoader" class="loader-spinner"></div>
      <div id="mediaFallback" class="fallback-note">Photo will reveal on submit</div>
    `;
    speciesImg = document.getElementById('activePhoto');
    imgPlaceholder = document.getElementById('mediaFallback');
  }

  if (speciesImg) {
    speciesImg.classList.remove('revealed');
    speciesImg.removeAttribute('src');
  }

  try {
    const res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(sciName)}&per_page=1`);
    const data = await res.json();
    const taxon = data.results?.[0];
    if (taxon?.default_photo?.medium_url && speciesImg) {
      speciesImg.src = taxon.default_photo.medium_url;
      if (hintUsedThisQ) revealImage();
    }
  } catch (e) {}
}

function revealImage() {
  if (speciesImg) speciesImg.classList.add('revealed');
  if (imgPlaceholder) imgPlaceholder.style.opacity = '0';
}

document.addEventListener('DOMContentLoaded', loadDataAndInit);
